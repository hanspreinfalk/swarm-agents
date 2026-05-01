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
  SidebarMenuBadge,
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
import { THREAD_GROUPS } from "./data";

interface AppSidebarProps {
  activeThread: string;
  onSelectThread: (id: string) => void;
}

export function AppSidebar({ activeThread, onSelectThread }: AppSidebarProps) {
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

        {/* Top nav actions */}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="New thread"
              className="text-[13px] font-medium"
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
        {/* Expanded mode: grouped thread labels */}
        <SidebarGroup className="p-2 group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel className="px-2">
            Threads
          </SidebarGroupLabel>

          <SidebarGroupContent>
            {THREAD_GROUPS.map((group) => (
              <SidebarGroup
                key={group.id}
                className="p-0"
              >
                <SidebarGroupLabel className="px-2 text-[11px] font-medium">
                  {group.label}
                </SidebarGroupLabel>

                <SidebarMenu>
                  {group.items.map((item) => (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        isActive={activeThread === item.id}
                        onClick={() => onSelectThread(item.id)}
                        tooltip={item.title}
                        size="sm"
                        className="text-[13px]"
                      >
                        <FileIcon className="shrink-0" />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                      {/* Badge already has group-data-[collapsible=icon]:hidden built in */}
                      <SidebarMenuBadge className="text-[11px]">
                        {item.time}
                      </SidebarMenuBadge>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroup>
            ))}
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Collapsed mode: flat icon-only list with no nested group padding */}
        <div className="hidden px-2 py-2 group-data-[collapsible=icon]:block">
          <SidebarMenu>
            {THREAD_GROUPS.flatMap((group) => group.items).map((item) => (
              <SidebarMenuItem key={item.id}>
                <SidebarMenuButton
                  isActive={activeThread === item.id}
                  onClick={() => onSelectThread(item.id)}
                  tooltip={item.title}
                  className="mx-auto size-8 justify-center p-0"
                >
                  <FileIcon className="size-4 shrink-0" />
                  <span className="sr-only">{item.title}</span>
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
