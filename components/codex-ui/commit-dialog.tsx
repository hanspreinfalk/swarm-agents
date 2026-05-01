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

const SUGGESTED_COMMIT_MESSAGE =
  "Refine SwarmAgents workspace UI\n\nAdd repository controls, preview/code switching, prompt attachments, and polish the coding workspace layout.";

interface CommitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommitDialog({ open, onOpenChange }: CommitDialogProps) {
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
              defaultValue={SUGGESTED_COMMIT_MESSAGE}
              id="commit-message"
            />
          </div>

          <Commit defaultOpen className="overflow-hidden">
            <CommitHeader>
              <CommitInfo>
                <CommitMessage>Workspace UI updates</CommitMessage>
                <CommitMetadata>
                  2 files changed · +9 · -6
                </CommitMetadata>
              </CommitInfo>
            </CommitHeader>
            <CommitContent>
              <div className="space-y-1">
                <CommitFile>
                  <CommitFileInfo>
                    <CommitFileStatus status="modified" />
                    <CommitFileIcon />
                    <CommitFilePath>src/hero.tsx</CommitFilePath>
                  </CommitFileInfo>
                  <CommitFileChanges>
                    <CommitFileAdditions count={8} />
                    <CommitFileDeletions count={5} />
                  </CommitFileChanges>
                </CommitFile>
                <CommitFile>
                  <CommitFileInfo>
                    <CommitFileStatus status="modified" />
                    <CommitFileIcon />
                    <CommitFilePath>tools/build.py</CommitFilePath>
                  </CommitFileInfo>
                  <CommitFileChanges>
                    <CommitFileAdditions count={1} />
                    <CommitFileDeletions count={1} />
                  </CommitFileChanges>
                </CommitFile>
              </div>
            </CommitContent>
          </Commit>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button type="button">Commit changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
