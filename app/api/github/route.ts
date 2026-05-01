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

type GithubFile = {
  path: string;
  content: string;
  language: "typescript" | "javascript" | "python";
  sha?: string;
  size?: number;
};

const MAX_SYNCED_FILES = 300;
const MAX_FILE_SIZE_BYTES = 200_000;

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

function getGithubToken() {
  return process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? process.env.GITHUB_PAT;
}

function parseRepo(fullName: string) {
  const [owner, repo] = fullName.split("/");
  if (!owner || !repo || fullName.split("/").length !== 2) {
    throw new Error("Repository must be in owner/name format.");
  }
  return { owner, repo };
}

function assertToken() {
  const token = getGithubToken();
  if (!token) {
    throw new Error("Missing GITHUB_TOKEN, GH_TOKEN, or GITHUB_PAT.");
  }
  return token;
}

async function githubRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = assertToken();
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

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GitHub request failed (${response.status}): ${detail}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
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
  const repos = await githubRequest<GithubRepoResponse[]>(
    "/user/repos?per_page=100&sort=pushed&affiliation=owner,collaborator,organization_member"
  );

  return repos.map((repo) => ({
    fullName: repo.full_name,
    defaultBranch: repo.default_branch,
    htmlUrl: repo.html_url,
    private: repo.private,
  }));
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
    .filter((entry) => entry.type === "blob" && shouldSyncFile(entry.path, entry.size))
    .slice(0, MAX_SYNCED_FILES);

  const files = await Promise.all(
    fileEntries.map(async (entry): Promise<GithubFile | null> => {
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
    })
  );

  return {
    branch,
    commitSha: branchInfo.commit.sha,
    truncated: tree.truncated || tree.tree.length > fileEntries.length,
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
      action: "listRepos" | "listBranches" | "sync" | "createBranch" | "commit";
      repositoryFullName?: string;
      branch?: string;
      sourceBranch?: string;
      newBranch?: string;
      message?: string;
      files?: GithubFile[];
    };

    if (body.action === "listRepos") {
      return Response.json({ repositories: await listRepos() });
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
