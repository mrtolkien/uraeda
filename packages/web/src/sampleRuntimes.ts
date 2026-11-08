// The runtimes the session picker's stories and tests offer: Claude Code and Codex, with the models
// and the efforts they listed on this machine on 2026-11-08, Codex's hidden models left out, and the
// defaults their own settings gave.
import type { PickerRuntime } from "./SessionPicker.tsx";

const EFFORTS = [
  { id: "low", name: "Low" },
  { id: "medium", name: "Medium" },
  { id: "high", name: "High" },
  { id: "xhigh", name: "Extra high" },
  { id: "max", name: "Max" },
  { id: "ultra", name: "Ultra" },
];

/** Claude Code stops at Max. */
const CLAUDE_EFFORTS = EFFORTS.slice(0, 5);

/** Claude Code, as `list_models` gave it: the aliases, then a pinned model without efforts. */
export const CLAUDE: PickerRuntime = {
  defaults: { effort: "medium", model: "opus" },
  icon: "uraeda:harness-claude",
  kind: "claude",
  models: [
    { description: "Opus 5.5", efforts: CLAUDE_EFFORTS, id: "opus", name: "Opus" },
    { description: "Fable 5.1", efforts: CLAUDE_EFFORTS, id: "fable", name: "Fable" },
    { description: "Sonnet 5.5", efforts: CLAUDE_EFFORTS, id: "sonnet", name: "Sonnet" },
    { description: "Haiku 5.5", efforts: CLAUDE_EFFORTS, id: "haiku", name: "Haiku" },
    { efforts: [], id: "claude-haiku-4-5-20251001", name: "Haiku 4.5" },
  ],
  name: "Claude Code",
};

/** Codex, as `model/list` gave it, its defaults from `config/read`. */
export const CODEX: PickerRuntime = {
  defaults: { effort: "medium", model: "gpt-6.1-sol" },
  icon: "uraeda:harness-openai",
  kind: "codex",
  models: [
    {
      description: "Latest workhorse model for coding and everyday work.",
      efforts: EFFORTS,
      id: "gpt-6.1-sol",
      name: "GPT-6.1-Sol",
    },
    {
      description: "Frontier intelligence for the most demanding work.",
      efforts: EFFORTS,
      id: "gpt-6-astra",
      name: "GPT-6-Astra",
    },
    {
      description: "Fast and affordable model for easier tasks.",
      efforts: EFFORTS.slice(0, 5),
      id: "gpt-6-luna",
      name: "GPT-6-Luna",
    },
  ],
  name: "Codex",
};
