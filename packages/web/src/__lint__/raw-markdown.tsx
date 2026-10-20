// Astryx's Markdown outside `Prose.tsx`: refused by `no-restricted-imports`, which names Prose.
import { Markdown } from "@astryxdesign/core/Markdown";

export function RawMarkdown({ text }: { text: string }) {
  return <Markdown>{text}</Markdown>;
}
