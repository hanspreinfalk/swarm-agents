"use client";

import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorName,
  ModelSelectorSeparator,
  ModelSelectorShortcut,
  ModelSelectorTrigger,
} from "@/components/ai-elements/model-selector";
import { PromptInputButton } from "@/components/ai-elements/prompt-input";
import { ChevronDownIcon } from "lucide-react";

// ─── Model catalogue ─────────────────────────────────────────────

interface Model {
  id: string;
  name: string;
  context: string;
}

interface ModelGroup {
  provider:
    | "openai"
    | "anthropic"
    | "google"
    | "deepseek"
    | "mistral"
    | "meta-llama";
  heading: string;
  models: Model[];
}

const MODEL_GROUPS: ModelGroup[] = [
  {
    provider: "openai",
    heading: "OpenAI",
    models: [
      { id: "gpt-4.1",       name: "GPT-4.1",       context: "1M"   },
      { id: "gpt-4.1-mini",  name: "GPT-4.1 Mini",  context: "128k" },
      { id: "o3",            name: "o3",            context: "200k" },
      { id: "o4-mini",       name: "o4-mini",       context: "200k" },
    ],
  },
  {
    provider: "anthropic",
    heading: "Anthropic",
    models: [
      { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5", context: "200k" },
      { id: "claude-opus-4-5",   name: "Claude Opus 4.5",   context: "200k" },
      { id: "claude-haiku-4-5",  name: "Claude Haiku 4.5",  context: "200k" },
    ],
  },
  {
    provider: "google",
    heading: "Google",
    models: [
      { id: "gemini-2.5-pro",   name: "Gemini 2.5 Pro",   context: "1M" },
      { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash",  context: "1M" },
    ],
  },
  {
    provider: "deepseek",
    heading: "DeepSeek",
    models: [
      { id: "deepseek-v3",       name: "DeepSeek V3",       context: "64k" },
      { id: "deepseek-r1",       name: "DeepSeek R1",       context: "64k" },
    ],
  },
  {
    provider: "mistral",
    heading: "Mistral",
    models: [
      { id: "mistral-large",  name: "Mistral Large",  context: "128k" },
      { id: "mistral-small",  name: "Mistral Small",  context: "128k" },
    ],
  },
];

// ─── Find model by id ─────────────────────────────────────────────

function findModel(id: string): Model | undefined {
  for (const group of MODEL_GROUPS) {
    const found = group.models.find((m) => m.id === id);
    if (found) return found;
  }
}

// ─── Component ────────────────────────────────────────────────────

interface ModelSelectorInputProps {
  value: string;
  onChange: (modelId: string) => void;
}

export function ModelSelectorInput_({
  value,
  onChange,
}: ModelSelectorInputProps) {
  const active = findModel(value);
  const providerOfActive = MODEL_GROUPS.find((g) =>
    g.models.some((m) => m.id === value)
  );

  return (
    <ModelSelector>
      {/* ── Trigger ─────────────────────────────────────── */}
      <ModelSelectorTrigger asChild>
        <PromptInputButton
          size="sm"
          tooltip={{ content: "Switch model", side: "top" }}
          className="h-7 gap-1.5 rounded-lg px-2.5 text-[12px] font-medium text-muted-foreground hover:text-foreground"
        >
          {providerOfActive && (
            <ModelSelectorLogo
              provider={providerOfActive.provider}
              className="size-3.5"
            />
          )}
          <span>{active?.name ?? "Select model"}</span>
          <ChevronDownIcon size={11} className="opacity-60" />
        </PromptInputButton>
      </ModelSelectorTrigger>

      {/* ── Modal ───────────────────────────────────────── */}
      <ModelSelectorContent className="w-[420px]" title="Select a model">
        <ModelSelectorInput placeholder="Search models…" />
        <ModelSelectorList className="max-h-[500px]">
          <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>

          {MODEL_GROUPS.map((group, idx) => (
            <span key={group.provider}>
              {idx > 0 && <ModelSelectorSeparator />}
              <ModelSelectorGroup heading={group.heading}>
                {group.models.map((model) => (
                  <ModelSelectorItem
                    key={model.id}
                    value={model.id}
                    onSelect={() => onChange(model.id)}
                    className="gap-2.5"
                  >
                    <ModelSelectorLogo
                      provider={group.provider}
                      className="size-3.5 shrink-0"
                    />
                    <ModelSelectorName className="text-[13px]">
                      {model.name}
                    </ModelSelectorName>
                    <ModelSelectorShortcut className="text-[11px] text-muted-foreground">
                      {model.context}
                    </ModelSelectorShortcut>
                    {/* Active indicator */}
                    {model.id === value && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-foreground" />
                    )}
                  </ModelSelectorItem>
                ))}
              </ModelSelectorGroup>
            </span>
          ))}
        </ModelSelectorList>
      </ModelSelectorContent>
    </ModelSelector>
  );
}
