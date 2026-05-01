"use client";

import {
  Commit,
  CommitContent,
  CommitFile,
  CommitFileAdditions,
  CommitFileChanges,
  CommitFileDeletions,
  CommitFileIcon,
  CommitFileInfo,
  CommitFilePath,
  CommitFileStatus,
  CommitHeader,
  CommitInfo,
  CommitMessage,
  CommitMetadata,
} from "@/components/ai-elements/commit";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";

interface CommitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: string[];
  repositoryFullName: string | null;
  branch: string | null;
  isCommitting: boolean;
  onCommit: (message: string) => void | Promise<void>;
}

export function CommitDialog({
  open,
  onOpenChange,
  files,
  repositoryFullName,
  branch,
  isCommitting,
  onCommit,
}: CommitDialogProps) {
  const [message, setMessage] = useState("Update repository files");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Commit changes</DialogTitle>
          <DialogDescription>
            Review the suggested commit message before creating a commit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label
              className="text-[12px] font-medium text-muted-foreground"
              htmlFor="commit-message"
            >
              Suggested commit message
            </label>
            <Textarea
              className="min-h-28 resize-none font-mono text-[12px]"
              id="commit-message"
              onChange={(event) => setMessage(event.target.value)}
              value={message}
            />
          </div>

          <Commit defaultOpen className="overflow-hidden">
            <CommitHeader>
              <CommitInfo>
                <CommitMessage>
                  {repositoryFullName && branch
                    ? `${repositoryFullName} · ${branch}`
                    : "No repository selected"}
                </CommitMessage>
                <CommitMetadata>
                  {files.length} {files.length === 1 ? "file" : "files"} ready to commit
                </CommitMetadata>
              </CommitInfo>
            </CommitHeader>
            <CommitContent>
              <div className="space-y-1">
                {files.slice(0, 25).map((file) => (
                  <CommitFile key={file}>
                    <CommitFileInfo>
                      <CommitFileStatus status="modified" />
                      <CommitFileIcon />
                      <CommitFilePath>{file}</CommitFilePath>
                    </CommitFileInfo>
                    <CommitFileChanges>
                      <CommitFileAdditions count={0} />
                      <CommitFileDeletions count={0} />
                    </CommitFileChanges>
                  </CommitFile>
                ))}
                {files.length > 25 ? (
                  <div className="px-2 py-1 text-[12px] text-muted-foreground">
                    +{files.length - 25} more files
                  </div>
                ) : null}
              </div>
            </CommitContent>
          </Commit>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            disabled={
              isCommitting ||
              !repositoryFullName ||
              !branch ||
              files.length === 0 ||
              message.trim().length === 0
            }
            onClick={() => onCommit(message)}
            type="button"
          >
            {isCommitting ? "Committing..." : "Commit changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
