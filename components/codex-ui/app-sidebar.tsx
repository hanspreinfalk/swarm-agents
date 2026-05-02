"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FileIcon,
  GlobeIcon,
  LogOutIcon,
  MonitorIcon,
  MoonIcon,
  MoreHorizontalIcon,
  PlusIcon,
  SettingsIcon,
  SunIcon,
} from "lucide-react";
import Image from "next/image";
import { useClerk, useUser } from "@clerk/nextjs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Doc } from "@/convex/_generated/dataModel";
import { formatDistanceToNow } from "date-fns";

interface AppSidebarProps {
  activeThread: string | null;
  threads: Doc<"threads">[];
  onSelectThread: (id: string) => void;
  onNewThread: () => void;
  onRenameThread: (threadId: string, title: string) => void | Promise<void>;
  onDeleteThread: (threadId: string) => void | Promise<void>;
}

function relativeTime(ms: number) {
  return formatDistanceToNow(new Date(ms), { addSuffix: true });
}

export function AppSidebar({
  activeThread,
  threads,
  onSelectThread,
  onNewThread,
  onRenameThread,
  onDeleteThread,
}: AppSidebarProps) {
  const { user, isLoaded } = useUser();
  const clerk = useClerk();

  const [renameTargetId, setRenameTargetId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [renameSubmitting, setRenameSubmitting] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const { theme, setTheme } = useTheme();
  const [themeReady, setThemeReady] = useState(false);
  useEffect(() => {
    setThemeReady(true);
  }, []);

  const deleteTarget = deleteTargetId
    ? threads.find((t) => t._id === deleteTargetId)
    : undefined;

  const handleRenameSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!renameTargetId) return;
    setRenameSubmitting(true);
    try {
      await onRenameThread(renameTargetId, renameDraft);
      setRenameTargetId(null);
    } finally {
      setRenameSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTargetId) return;
    setDeleteSubmitting(true);
    try {
      await onDeleteThread(deleteTargetId);
      setDeleteTargetId(null);
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const handleLogoutConfirm = async () => {
    if (!clerk.loaded) return;
    setSigningOut(true);
    try {
      await clerk.signOut();
      setLogoutConfirmOpen(false);
    } finally {
      setSigningOut(false);
    }
  };

  const displayName =
    user?.fullName?.trim() ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    user?.username?.trim() ||
    user?.primaryEmailAddress?.emailAddress ||
    "Account";

  const profileInitial =
    displayName === "Account"
      ? "?"
      : displayName
          .split(/\s+/)
          .map((p) => p[0])
          .join("")
          .slice(0, 2)
          .toUpperCase();

  return (
    <>
      <Sidebar collapsible="icon">
        {/* ── Header ─────────────────────────────────────────────── */}
        <SidebarHeader className="p-2">
          <div className="flex items-center px-2 py-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 gap-2">
            <Image
              src="/logo.svg"
              alt="SwarmAgents"
              width={24}
              height={24}
              className="shrink-0"
            />
            <p className="group-data-[collapsible=icon]:hidden">SwarmAgents</p>
          </div>

          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="New thread"
                className="text-[13px] font-medium"
                onClick={onNewThread}
              >
                <PlusIcon />
                <span>New thread</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Skills"
                className="text-[13px] font-medium"
              >
                <GlobeIcon />
                <span>Skills</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <div className="overflow-hidden px-4 group-data-[collapsible=icon]:px-2">
          <div className="h-px w-full bg-sidebar-border" />
        </div>

        {/* ── Thread list ─────────────────────────────────────────── */}
        <SidebarContent>
          <SidebarGroup className="p-2 group-data-[collapsible=icon]:hidden">
            <SidebarGroupLabel className="px-2">Threads</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {threads.length === 0 ? (
                  <p className="px-2 py-4 text-center text-[12px] text-muted-foreground">
                    No threads yet. Start a new one!
                  </p>
                ) : (
                  threads.map((thread) => (
                    <SidebarMenuItem key={thread._id}>
                      <div className="flex w-full min-w-0 items-stretch gap-0.5">
                        <SidebarMenuButton
                          isActive={activeThread === thread._id}
                          onClick={() => onSelectThread(thread._id)}
                          tooltip={thread.title}
                          size="sm"
                          className="h-auto min-w-0 flex-1 flex-col items-start gap-0.5 py-2 text-[13px]"
                        >
                          <div className="flex w-full min-w-0 items-center gap-2">
                            <FileIcon className="size-3.5 shrink-0" />
                            <span className="truncate font-medium">{thread.title}</span>
                          </div>
                          <span className="pl-5 text-[11px] text-muted-foreground">
                            {relativeTime(thread.updatedAt)}
                          </span>
                        </SidebarMenuButton>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="mt-1 shrink-0 text-muted-foreground hover:text-foreground"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                            >
                              <MoreHorizontalIcon className="size-4" />
                              <span className="sr-only">Thread actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem
                              onSelect={() => {
                                setRenameTargetId(thread._id);
                                setRenameDraft(thread.title);
                              }}
                            >
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => setDeleteTargetId(thread._id)}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </SidebarMenuItem>
                  ))
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Collapsed mode: icon-only list */}
          <div className="hidden px-2 py-2 group-data-[collapsible=icon]:block">
            <SidebarMenu>
              {threads.map((thread) => (
                <SidebarMenuItem key={thread._id}>
                  <div className="group/row relative flex w-full justify-center">
                    <SidebarMenuButton
                      isActive={activeThread === thread._id}
                      onClick={() => onSelectThread(thread._id)}
                      tooltip={thread.title}
                      className="size-8 justify-center p-0"
                    >
                      <FileIcon className="size-4 shrink-0" />
                      <span className="sr-only">{thread.title}</span>
                    </SidebarMenuButton>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="absolute -right-0.5 top-0 size-6 opacity-0 group-hover/row:opacity-100"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                        >
                          <MoreHorizontalIcon className="size-3.5" />
                          <span className="sr-only">Thread actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" side="right" className="w-40">
                        <DropdownMenuItem
                          onSelect={() => {
                            setRenameTargetId(thread._id);
                            setRenameDraft(thread.title);
                          }}
                        >
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => setDeleteTargetId(thread._id)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </div>
        </SidebarContent>

        {/* ── Footer ─────────────────────────────────────────────── */}
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    type="button"
                    tooltip={displayName}
                    className="text-[13px] font-medium"
                    disabled={!isLoaded || !clerk.loaded}
                  >
                    <Avatar className="size-7 shrink-0 group-data-[collapsible=icon]:size-4">
                      {user?.imageUrl ? (
                        <AvatarImage src={user.imageUrl} alt={displayName} />
                      ) : null}
                      <AvatarFallback className="text-[10px] group-data-[collapsible=icon]:text-[8px]">
                        {isLoaded ? profileInitial : "…"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate group-data-[collapsible=icon]:hidden">
                      {isLoaded ? displayName : "Loading…"}
                    </span>
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="right"
                  align="end"
                  className="min-w-48"
                >
                  <DropdownMenuLabel className="text-muted-foreground">
                    Theme
                  </DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={themeReady ? (theme ?? "system") : "system"}
                    onValueChange={(value) =>
                      setTheme(value as "light" | "dark" | "system")
                    }
                  >
                    <DropdownMenuRadioItem value="light" className="gap-2">
                      <SunIcon className="size-4" />
                      Light
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="dark" className="gap-2">
                      <MoonIcon className="size-4" />
                      Dark
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="system" className="gap-2">
                      <MonitorIcon className="size-4" />
                      System
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={!clerk.loaded}
                    onSelect={() => {
                      if (clerk.loaded) clerk.openUserProfile();
                    }}
                    className="gap-2"
                  >
                    <SettingsIcon className="size-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    className="gap-2"
                    onSelect={(e) => {
                      e.preventDefault();
                      setLogoutConfirmOpen(true);
                    }}
                  >
                    <LogOutIcon className="size-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      <Dialog
        open={renameTargetId !== null}
        onOpenChange={(open) => {
          if (!open) setRenameTargetId(null);
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton>
          <form onSubmit={handleRenameSubmit}>
            <DialogHeader>
              <DialogTitle>Rename thread</DialogTitle>
              <DialogDescription>Choose a new title for this conversation.</DialogDescription>
            </DialogHeader>
            <Input
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              placeholder="Thread title"
              className="mt-2"
              autoFocus
            />
            <DialogFooter className="mt-4 sm:mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenameTargetId(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={renameSubmitting}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTargetId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTargetId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete thread?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `"${deleteTarget.title}" and all of its messages will be removed. This cannot be undone.`
                : "This thread and all of its messages will be removed. This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSubmitting}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteSubmitting}
              onClick={() => void handleDeleteConfirm()}
            >
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={logoutConfirmOpen}
        onOpenChange={(open) => {
          if (!signingOut) setLogoutConfirmOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Log out?</AlertDialogTitle>
            <AlertDialogDescription>
              You will need to sign in again to access your threads and messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={signingOut}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={signingOut}
              onClick={() => void handleLogoutConfirm()}
            >
              {signingOut ? "Signing out…" : "Log out"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
