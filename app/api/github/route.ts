import { auth, clerkClient } from "@clerk/nextjs/server";

type GithubRepoResponse = {
  full_name: string;
  default_branch: string;
  html_url: string;
  private: boolean;
};

type GithubBranchResponse = {
  name: string;
  commit: { sha: string };
};

type GithubTreeResponse = {
  sha: string;
  truncated: boolean;
  tree: Array<{
    path: string;
    mode: string;
    type: "blob" | "tree" | "commit";
    sha: string;
    size?: number;
  }>;
};

type GithubBlobResponse = {
  sha: string;
  content: string;
  encoding: string;
  size: number;
};

type GithubRefResponse = {
  ref: string;
  object: { sha: string; type: string };
};

type GithubCommitResponse = {
  sha: string;
  tree: { sha: string };
  commit?: {
    tree?: { sha: string };
  };
};

type GithubTreeCreateResponse = {
  sha: string;
};

type GithubCreateRepoRequest = {
  name: string;
  description?: string;
  private?: boolean;
  auto_init?: boolean;
};

type GithubFile = {
  path: string;
  content: string;
  language: "typescript" | "javascript" | "python";
  sha?: string;
  size?: number;
};

const MAX_FILE_SIZE_BYTES = 200_000;
const BLOB_SYNC_CONCURRENCY = 4;
const MAX_GITHUB_RETRIES = 5;
const RETRY_BASE_DELAY_MS = 1_000;

const TEXT_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".py",
  ".ts",
  ".tsx",
  ".txt",
  ".yml",
  ".yaml",
]);

async function getGithubToken(): Promise<string> {
  // Prefer the GitHub OAuth token from the signed-in Clerk user
  const { userId } = await auth();
  if (userId) {
    const client = await clerkClient();
    const { data } = await client.users.getUserOauthAccessToken(userId, "github");
    const token = data[0]?.token;
    if (token) return token;
  }

  // Fall back to a server-side env var (useful for testing / server jobs)
  const envToken = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? process.env.GITHUB_PAT;
  if (envToken) return envToken;

  throw new Error(
    "No GitHub access token found. Please sign in with GitHub or set GITHUB_TOKEN."
  );
}

function parseRepo(fullName: string) {
  const [owner, repo] = fullName.split("/");
  if (!owner || !repo || fullName.split("/").length !== 2) {
    throw new Error("Repository must be in owner/name format.");
  }
  return { owner, repo };
}

async function githubRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getGithubToken();
  for (let attempt = 0; attempt < MAX_GITHUB_RETRIES; attempt++) {
    const response = await fetch(`https://api.github.com${path}`, {
      ...init,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...init.headers,
      },
    });

    if (response.status === 204) {
      return undefined as T;
    }

    const data = await response.json() as unknown;
    const message = (data as { message?: string })?.message ?? response.statusText;
    const lowerMessage = message.toLowerCase();
    const isRateLimited =
      response.status === 429 ||
      (response.status === 403 &&
        (response.headers.get("x-ratelimit-remaining") === "0" ||
          lowerMessage.includes("rate limit") ||
          lowerMessage.includes("secondary rate limit")));

    if (!response.ok) {
      if (isRateLimited && attempt < MAX_GITHUB_RETRIES - 1) {
        const retryAfterMs = Number(response.headers.get("retry-after"));
        const resetAtSeconds = Number(response.headers.get("x-ratelimit-reset"));
        const resetDelayMs =
          Number.isFinite(resetAtSeconds) && resetAtSeconds > 0
            ? Math.max(0, resetAtSeconds * 1_000 - Date.now())
            : 0;
        const headerDelayMs =
          Number.isFinite(retryAfterMs) && retryAfterMs > 0 ? retryAfterMs * 1_000 : 0;
        const backoffDelayMs = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        const delayMs = Math.max(backoffDelayMs, headerDelayMs, resetDelayMs, RETRY_BASE_DELAY_MS);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      throw new Error(`GitHub API error (${response.status}): ${message}`);
    }

    // Guard: if GitHub returns an error object with status 200 (rare edge case)
    if (
      data !== null &&
      typeof data === "object" &&
      !Array.isArray(data) &&
      typeof (data as { message?: string }).message === "string"
    ) {
      const errMsg = (data as { message: string }).message;
      if (
        errMsg.toLowerCase().includes("bad credentials") ||
        errMsg.toLowerCase().includes("requires authentication")
      ) {
        throw new Error(`GitHub authentication error: ${errMsg}`);
      }
    }

    return data as T;
  }

  throw new Error("GitHub API request failed after retries.");
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex++;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

function extensionForPath(path: string) {
  const dot = path.lastIndexOf(".");
  return dot === -1 ? "" : path.slice(dot).toLowerCase();
}

function inferLanguage(path: string): GithubFile["language"] {
  const ext = extensionForPath(path);
  if (ext === ".py") return "python";
  if (ext === ".ts" || ext === ".tsx") return "typescript";
  return "javascript";
}

function shouldSyncFile(path: string, size = 0) {
  if (size > MAX_FILE_SIZE_BYTES) return false;
  if (path.includes("/.git/") || path.startsWith(".git/")) return false;
  if (path.includes("/node_modules/") || path.startsWith("node_modules/")) return false;
  if (path.includes("/.next/") || path.startsWith(".next/")) return false;
  return TEXT_EXTENSIONS.has(extensionForPath(path));
}

function decodeGithubContent(content: string) {
  return Buffer.from(content.replace(/\n/g, ""), "base64").toString("utf8");
}

function encodeBranchRef(branch: string) {
  return branch.split("/").map(encodeURIComponent).join("/");
}

async function listRepos() {
  const token = await getGithubToken();

  // Fetch user info and check scopes in parallel
  const userResponse = await fetch("https://api.github.com/user", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  const userData = await userResponse.json() as { login: string; public_repos?: number };
  if (!userResponse.ok) {
    const msg = (userData as unknown as { message?: string })?.message ?? userResponse.statusText;
    throw new Error(`GitHub API error (${userResponse.status}): ${msg}`);
  }

  // GitHub returns granted scopes in the X-OAuth-Scopes header
  const grantedScopes = userResponse.headers.get("x-oauth-scopes") ?? "";
  const hasRepoScope = grantedScopes.split(",").map((s) => s.trim()).some((s) => s === "repo");

  // Fetch repos — works with any scope; private repos require `repo` scope
  const allRepos: GithubRepoResponse[] = [];
  let page = 1;
  while (true) {
    const batch = await githubRequest<GithubRepoResponse[]>(
      `/user/repos?per_page=100&page=${page}&sort=pushed&affiliation=owner,collaborator,organization_member`
    );
    if (!Array.isArray(batch) || batch.length === 0) break;
    allRepos.push(...batch);
    if (batch.length < 100) break;
    page++;
  }

  return {
    authenticatedAs: userData.login,
    hasRepoScope,
    repositories: allRepos.map((repo) => ({
      fullName: repo.full_name,
      defaultBranch: repo.default_branch,
      htmlUrl: repo.html_url,
      private: repo.private,
    })),
  };
}

async function createRepo(name: string, description?: string, isPrivate = false) {
  const repo = await githubRequest<GithubRepoResponse>("/user/repos", {
    method: "POST",
    body: JSON.stringify({
      name,
      ...(description ? { description } : {}),
      private: isPrivate,
      auto_init: true,
    } satisfies GithubCreateRepoRequest),
  });

  return {
    fullName: repo.full_name,
    defaultBranch: repo.default_branch,
    htmlUrl: repo.html_url,
    private: repo.private,
  };
}

async function listBranches(repositoryFullName: string) {
  const { owner, repo } = parseRepo(repositoryFullName);
  const branches = await githubRequest<GithubBranchResponse[]>(
    `/repos/${owner}/${repo}/branches?per_page=100`
  );

  return branches.map((branch) => ({
    name: branch.name,
    sha: branch.commit.sha,
  }));
}

async function syncRepository(repositoryFullName: string, branch: string) {
  const { owner, repo } = parseRepo(repositoryFullName);
  const branchInfo = await githubRequest<GithubBranchResponse>(
    `/repos/${owner}/${repo}/branches/${encodeBranchRef(branch)}`
  );
  const tree = await githubRequest<GithubTreeResponse>(
    `/repos/${owner}/${repo}/git/trees/${branchInfo.commit.sha}?recursive=1`
  );

  const fileEntries = tree.tree
    .filter((entry) => entry.type === "blob" && shouldSyncFile(entry.path, entry.size));

  const files = await mapWithConcurrency(
    fileEntries,
    BLOB_SYNC_CONCURRENCY,
    async (entry): Promise<GithubFile | null> => {
      const blob = await githubRequest<GithubBlobResponse>(
        `/repos/${owner}/${repo}/git/blobs/${entry.sha}`
      );
      if (blob.encoding !== "base64") return null;
      return {
        path: entry.path,
        content: decodeGithubContent(blob.content),
        language: inferLanguage(entry.path),
        sha: blob.sha,
        size: blob.size,
      };
    }
  );

  return {
    branch,
    commitSha: branchInfo.commit.sha,
    truncated: tree.truncated,
    files: files.filter((file): file is GithubFile => file !== null),
  };
}

async function createBranch(
  repositoryFullName: string,
  sourceBranch: string,
  newBranch: string
) {
  const { owner, repo } = parseRepo(repositoryFullName);
  const source = await githubRequest<GithubRefResponse>(
    `/repos/${owner}/${repo}/git/ref/heads/${encodeBranchRef(sourceBranch)}`
  );

  await githubRequest<GithubRefResponse>(`/repos/${owner}/${repo}/git/refs`, {
    method: "POST",
    body: JSON.stringify({
      ref: `refs/heads/${newBranch}`,
      sha: source.object.sha,
    }),
  });

  return { name: newBranch, sha: source.object.sha };
}

async function commitFiles(
  repositoryFullName: string,
  branch: string,
  message: string,
  files: GithubFile[]
) {
  const { owner, repo } = parseRepo(repositoryFullName);
  const ref = await githubRequest<GithubRefResponse>(
    `/repos/${owner}/${repo}/git/ref/heads/${encodeBranchRef(branch)}`
  );
  const baseCommit = await githubRequest<GithubCommitResponse>(
    `/repos/${owner}/${repo}/git/commits/${ref.object.sha}`
  );

  const treeEntries = await Promise.all(
    files.map(async (file) => {
      const blob = await githubRequest<{ sha: string }>(
        `/repos/${owner}/${repo}/git/blobs`,
        {
          method: "POST",
          body: JSON.stringify({
            content: file.content,
            encoding: "utf-8",
          }),
        }
      );

      return {
        path: file.path,
        mode: "100644",
        type: "blob",
        sha: blob.sha,
      };
    })
  );

  const tree = await githubRequest<GithubTreeCreateResponse>(
    `/repos/${owner}/${repo}/git/trees`,
    {
      method: "POST",
      body: JSON.stringify({
        base_tree: baseCommit.tree.sha,
        tree: treeEntries,
      }),
    }
  );

  const commit = await githubRequest<GithubCommitResponse>(
    `/repos/${owner}/${repo}/git/commits`,
    {
      method: "POST",
      body: JSON.stringify({
        message,
        tree: tree.sha,
        parents: [ref.object.sha],
      }),
    }
  );

  await githubRequest<GithubRefResponse>(
    `/repos/${owner}/${repo}/git/refs/heads/${encodeBranchRef(branch)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ sha: commit.sha }),
    }
  );

  return {
    sha: commit.sha,
    htmlUrl: `https://github.com/${repositoryFullName}/commit/${commit.sha}`,
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action: "listRepos" | "listBranches" | "sync" | "createBranch" | "commit" | "createRepo";
      repositoryFullName?: string;
      branch?: string;
      sourceBranch?: string;
      newBranch?: string;
      message?: string;
      files?: GithubFile[];
      repoName?: string;
      description?: string;
      isPrivate?: boolean;
    };

    if (body.action === "listRepos") {
      const result = await listRepos();
      return Response.json(result);
    }

    if (body.action === "createRepo") {
      if (!body.repoName) {
        return Response.json({ error: "repoName is required." }, { status: 400 });
      }
      return Response.json(
        await createRepo(body.repoName, body.description, body.isPrivate ?? false)
      );
    }

    if (!body.repositoryFullName) {
      return Response.json({ error: "repositoryFullName is required." }, { status: 400 });
    }

    if (body.action === "listBranches") {
      return Response.json({
        branches: await listBranches(body.repositoryFullName),
      });
    }

    if (body.action === "sync") {
      if (!body.branch) {
        return Response.json({ error: "branch is required." }, { status: 400 });
      }
      return Response.json(await syncRepository(body.repositoryFullName, body.branch));
    }

    if (body.action === "createBranch") {
      if (!body.sourceBranch || !body.newBranch) {
        return Response.json(
          { error: "sourceBranch and newBranch are required." },
          { status: 400 }
        );
      }
      return Response.json(
        await createBranch(body.repositoryFullName, body.sourceBranch, body.newBranch)
      );
    }

    if (body.action === "commit") {
      if (!body.branch || !body.message || !body.files) {
        return Response.json(
          { error: "branch, message, and files are required." },
          { status: 400 }
        );
      }
      return Response.json(
        await commitFiles(body.repositoryFullName, body.branch, body.message, body.files)
      );
    }

    return Response.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "GitHub request failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
