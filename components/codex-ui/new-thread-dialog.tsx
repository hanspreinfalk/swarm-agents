"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GitBranchIcon, GlobeIcon, LockIcon, RefreshCwIcon, SearchIcon } from "lucide-react";

export type GithubRepository = {
  fullName: string;
  defaultBranch: string;
  htmlUrl: string;
  private: boolean;
};

type GithubBranch = {
  name: string;
  sha: string;
};

export type ExistingProject = {
  _id: string;
  name: string;
  repositoryFullName: string;
  branch: string;
};

async function fetchBranches(repoFullName: string): Promise<GithubBranch[]> {
  const response = await fetch("/api/github", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "listBranches", repositoryFullName: repoFullName }),
  });
  const data = (await response.json()) as { branches?: GithubBranch[]; error?: string };
  if (!response.ok) throw new Error(data.error ?? "Failed to load branches");
  return data.branches ?? [];
}

interface NewThreadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repos: GithubRepository[];
  projects: ExistingProject[];
  isLoadingRepos: boolean;
  isLoadingProjects: boolean;
  repoError: string | null;
  githubUser: string | null;
  onRefreshRepos: () => void;
  onCreateWithExisting: (repoFullName: string, branch: string) => Promise<void>;
  onCreateWithProject: (projectId: string) => Promise<void>;
  onCreateWithNew: (repoName: string, description: string, isPrivate: boolean) => Promise<void>;
}

export function NewThreadDialog({
  open,
  onOpenChange,
  repos,
  projects,
  isLoadingRepos,
  isLoadingProjects,
  repoError,
  githubUser,
  onRefreshRepos,
  onCreateWithExisting,
  onCreateWithProject,
  onCreateWithNew,
}: NewThreadDialogProps) {
  const [mode, setMode] = useState<"existing" | "projects" | "new">("existing");

  // Existing repo state
  const [repoSearch, setRepoSearch] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<GithubRepository | null>(null);
  const [branches, setBranches] = useState<GithubBranch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [branchError, setBranchError] = useState<string | null>(null);
  const [projectSearch, setProjectSearch] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  // New repo state
  const [newRepoName, setNewRepoName] = useState("");
  const [newRepoDescription, setNewRepoDescription] = useState("");
  const [newRepoPrivate, setNewRepoPrivate] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const repoSearchInputRef = useRef<HTMLInputElement>(null);

  // Reset on open before paint so focus / tabs are correct when the dialog traps focus
  useLayoutEffect(() => {
    if (!open) return;
    setMode("existing");
    setRepoSearch("");
    setSelectedRepo(null);
    setBranches([]);
    setSelectedBranch("");
    setBranchError(null);
    setProjectSearch("");
    setSelectedProjectId("");
    setNewRepoName("");
    setNewRepoDescription("");
    setNewRepoPrivate(false);
    setIsSubmitting(false);
  }, [open]);

  // Load branches when a repo is selected
  useEffect(() => {
    if (!selectedRepo) {
      setBranches([]);
      setSelectedBranch("");
      setBranchError(null);
      return;
    }
    let cancelled = false;
    setIsLoadingBranches(true);
    setBranchError(null);
    fetchBranches(selectedRepo.fullName)
      .then((nextBranches) => {
        if (cancelled) return;
        setBranches(nextBranches);
        setSelectedBranch(
          nextBranches.some((b) => b.name === selectedRepo.defaultBranch)
            ? selectedRepo.defaultBranch
            : (nextBranches[0]?.name ?? "")
        );
      })
      .catch((err) => {
        if (!cancelled)
          setBranchError(err instanceof Error ? err.message : "Could not load branches.");
      })
      .finally(() => {
        if (!cancelled) setIsLoadingBranches(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedRepo]);

  const filteredRepos = repos.filter((r) =>
    r.fullName.toLowerCase().includes(repoSearch.toLowerCase())
  );
  const filteredProjects = projects.filter((project) => {
    const query = projectSearch.toLowerCase();
    return (
      project.name.toLowerCase().includes(query) ||
      project.repositoryFullName.toLowerCase().includes(query)
    );
  });

  const handleExistingSubmit = async () => {
    if (!selectedRepo || !selectedBranch) return;
    setIsSubmitting(true);
    try {
      await onCreateWithExisting(selectedRepo.fullName, selectedBranch);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNewSubmit = async () => {
    const name = newRepoName.trim();
    if (!name) return;
    setIsSubmitting(true);
    try {
      await onCreateWithNew(name, newRepoDescription.trim(), newRepoPrivate);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProjectSubmit = async () => {
    if (!selectedProjectId) return;
    setIsSubmitting(true);
    try {
      await onCreateWithProject(selectedProjectId);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          queueMicrotask(() => repoSearchInputRef.current?.focus());
        }}
      >
        <DialogHeader>
          <DialogTitle>New thread</DialogTitle>
          <DialogDescription>
            {githubUser ? (
              <>
                Connected as{" "}
                <a
                  href={`https://github.com/${githubUser}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-foreground hover:underline"
                >
                  @{githubUser}
                </a>
                . Pick a repo or create one to start.
              </>
            ) : (
              "Link this thread to a GitHub repository to start working."
            )}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as "existing" | "projects" | "new")}>
          <TabsList className="w-full">
            <TabsTrigger value="existing" className="flex-1 text-[13px]">
              GitHub repo
            </TabsTrigger>
            <TabsTrigger value="projects" className="flex-1 text-[13px]">
              Existing project
            </TabsTrigger>
            <TabsTrigger value="new" className="flex-1 text-[13px]">
              New repository
            </TabsTrigger>
          </TabsList>

          {/* ── Existing repository ───────────────────────────── */}
          <TabsContent value="existing" className="mt-4 space-y-4">
            <div className="space-y-2">
              <div className="relative">
                <SearchIcon
                  size={14}
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  ref={repoSearchInputRef}
                  placeholder="Search repositories…"
                  value={repoSearch}
                  onChange={(e) => setRepoSearch(e.target.value)}
                  className="pl-8 text-[13px]"
                />
              </div>
              <div className="flex items-center justify-between px-0.5">
                <span className="text-[11px] text-muted-foreground">
                  {isLoadingRepos
                    ? "Loading…"
                    : repoError
                      ? "Failed to load"
                      : `${repos.length} repositor${repos.length === 1 ? "y" : "ies"}`}
                </span>
                <button
                  type="button"
                  onClick={onRefreshRepos}
                  disabled={isLoadingRepos}
                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RefreshCwIcon size={11} className={isLoadingRepos ? "animate-spin" : ""} />
                  Refresh
                </button>
              </div>
            </div>

            {repoError && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
                {repoError}
              </p>
            )}

            <ScrollArea className="h-52 rounded-md border bg-muted/20">
              {isLoadingRepos ? (
                <div className="flex h-full items-center justify-center p-8 text-[13px] text-muted-foreground">
                  Loading repositories…
                </div>
              ) : filteredRepos.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-1 p-8 text-center">
                  <p className="text-[13px] text-muted-foreground">
                    {repos.length === 0
                      ? githubUser
                        ? `@${githubUser} has no accessible repositories.`
                        : "No repositories found."
                      : "No repositories match your search."}
                  </p>
                  {repos.length === 0 && githubUser && (
                    <p className="text-[12px] text-muted-foreground">
                      Make sure your GitHub token has the{" "}
                      <code className="rounded bg-muted px-1">repo</code> scope, or switch to the{" "}
                      <strong>New repository</strong> tab to create one.
                    </p>
                  )}
                </div>
              ) : (
                <div className="p-1">
                  {filteredRepos.map((repo) => (
                    <button
                      key={repo.fullName}
                      type="button"
                      onClick={() => setSelectedRepo(repo)}
                      className={[
                        "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] transition-colors hover:bg-muted",
                        selectedRepo?.fullName === repo.fullName
                          ? "bg-muted font-medium"
                          : "text-foreground/90",
                      ].join(" ")}
                    >
                      {repo.private ? (
                        <LockIcon size={13} className="shrink-0 text-muted-foreground" />
                      ) : (
                        <GlobeIcon size={13} className="shrink-0 text-muted-foreground" />
                      )}
                      <span className="min-w-0 flex-1 truncate">{repo.fullName}</span>
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                        {repo.defaultBranch}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>

            {selectedRepo && (
              <div className="space-y-1.5">
                <Label className="text-[12px] font-medium">Branch</Label>
                {branchError ? (
                  <p className="text-[12px] text-destructive">{branchError}</p>
                ) : (
                  <Select
                    value={selectedBranch}
                    onValueChange={setSelectedBranch}
                    disabled={isLoadingBranches || branches.length === 0}
                  >
                    <SelectTrigger className="gap-2 text-[13px]">
                      <GitBranchIcon size={13} className="shrink-0 text-muted-foreground" />
                      <SelectValue
                        placeholder={isLoadingBranches ? "Loading branches…" : "Select branch"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((b) => (
                        <SelectItem key={b.name} value={b.name} className="text-[13px]">
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleExistingSubmit()}
                disabled={!selectedRepo || !selectedBranch || isSubmitting || isLoadingBranches}
              >
                {isSubmitting ? "Creating…" : "Start thread"}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="projects" className="mt-4 space-y-4">
            <div className="space-y-2">
              <div className="relative">
                <SearchIcon
                  size={14}
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  placeholder="Search projects…"
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                  className="pl-8 text-[13px]"
                />
              </div>
              <div className="px-0.5 text-[11px] text-muted-foreground">
                {isLoadingProjects
                  ? "Loading projects…"
                  : `${projects.length} project${projects.length === 1 ? "" : "s"}`}
              </div>
            </div>

            <ScrollArea className="h-52 rounded-md border bg-muted/20">
              {isLoadingProjects ? (
                <div className="flex h-full items-center justify-center p-8 text-[13px] text-muted-foreground">
                  Loading projects…
                </div>
              ) : filteredProjects.length === 0 ? (
                <div className="flex h-full items-center justify-center p-8 text-center text-[13px] text-muted-foreground">
                  {projects.length === 0
                    ? "No projects yet. Sync a GitHub repository first."
                    : "No projects match your search."}
                </div>
              ) : (
                <div className="p-1">
                  {filteredProjects.map((project) => (
                    <button
                      key={project._id}
                      type="button"
                      onClick={() => setSelectedProjectId(project._id)}
                      className={[
                        "flex w-full flex-col items-start gap-0.5 rounded-md px-3 py-2 text-left text-[13px] transition-colors hover:bg-muted",
                        selectedProjectId === project._id
                          ? "bg-muted font-medium"
                          : "text-foreground/90",
                      ].join(" ")}
                    >
                      <span className="truncate">{project.name}</span>
                      <span className="truncate text-[11px] text-muted-foreground">
                        {project.repositoryFullName} · {project.branch}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleProjectSubmit()}
                disabled={!selectedProjectId || isSubmitting}
              >
                {isSubmitting ? "Creating…" : "Start thread"}
              </Button>
            </DialogFooter>
          </TabsContent>

          {/* ── New repository ────────────────────────────────── */}
          <TabsContent value="new" className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-repo-name" className="text-[12px] font-medium">
                Repository name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="new-repo-name"
                placeholder="my-awesome-project"
                value={newRepoName}
                onChange={(e) => setNewRepoName(e.target.value)}
                className="font-mono text-[13px]"
                autoComplete="off"
                spellCheck={false}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-repo-desc" className="text-[12px] font-medium">
                Description{" "}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="new-repo-desc"
                placeholder="Short description of the project"
                value={newRepoDescription}
                onChange={(e) => setNewRepoDescription(e.target.value)}
                className="text-[13px]"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 text-[13px] font-medium">
                  <LockIcon size={13} />
                  Private repository
                </div>
                <p className="text-[12px] text-muted-foreground">
                  Only you and collaborators can access it.
                </p>
              </div>
              <Switch checked={newRepoPrivate} onCheckedChange={setNewRepoPrivate} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleNewSubmit()}
                disabled={!newRepoName.trim() || isSubmitting}
              >
                {isSubmitting ? "Creating…" : "Create & start thread"}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
