"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function LandingThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [themeReady, setThemeReady] = useState(false);

  useEffect(() => {
    setThemeReady(true);
  }, []);

  const mode = themeReady ? (theme ?? "system") : "system";
  const TriggerIcon =
    mode === "dark" ? MoonIcon : mode === "light" ? SunIcon : MonitorIcon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-9 shrink-0 rounded-full"
          aria-label="Theme"
        >
          <TriggerIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
