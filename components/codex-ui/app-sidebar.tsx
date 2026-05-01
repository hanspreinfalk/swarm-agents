"use client";

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
  FileIcon,
  GlobeIcon,
  PlusIcon,
  SettingsIcon,
} from "lucide-react";
import Image from "next/image";
import { Doc } from "@/convex/_generated/dataModel";
import { formatDistanceToNow } from "date-fns";

interface AppSidebarProps {
  activeThread: string | null;
  threads: Doc<"threads">[];
  onSelectThread: (id: string) => void;
  onNewThread: () => void;
}

function relativeTime(ms: number) {
  return formatDistanceToNow(new Date(ms), { addSuffix: true });
}

export function AppSidebar({
  activeThread,
  threads,
  onSelectThread,
  onNewThread,
}: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon">
      {/* ── Header ─────────────────────────────────────────────── */}
      <SidebarHeader className="p-2">
        <div className="flex items-center px-2 py-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <Image
            src="/logo.svg"
            alt="SwarmAgents"
            width={24}
            height={24}
            className="shrink-0"
          />
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
                    <SidebarMenuButton
                      isActive={activeThread === thread._id}
                      onClick={() => onSelectThread(thread._id)}
                      tooltip={thread.title}
                      size="sm"
                      className="h-auto flex-col items-start gap-0.5 py-2 text-[13px]"
                    >
                      <div className="flex w-full items-center gap-2">
                        <FileIcon className="size-3.5 shrink-0" />
                        <span className="truncate font-medium">{thread.title}</span>
                      </div>
                      <span className="pl-5 text-[11px] text-muted-foreground">
                        {relativeTime(thread.updatedAt)}
                      </span>
                    </SidebarMenuButton>
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
                <SidebarMenuButton
                  isActive={activeThread === thread._id}
                  onClick={() => onSelectThread(thread._id)}
                  tooltip={thread.title}
                  className="mx-auto size-8 justify-center p-0"
                >
                  <FileIcon className="size-4 shrink-0" />
                  <span className="sr-only">{thread.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </div>
      </SidebarContent>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Settings" className="text-[13px]">
              <SettingsIcon />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
