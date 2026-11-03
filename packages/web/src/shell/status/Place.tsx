// The status line's right end while a field has the focus: the cursor's place, as lualine's
// `progress` and `location`, "Top" in section b then "3:9" in section z, in the mode's colour. With
// Vim off, the same place in section b alone, "Top 3:9", as the line has no mode's colour.
import { useMode } from "../../fields/editor/modeStore.ts";
import { Section, Separator, type Tone } from "./Sections.tsx";

/** The cursor's place in the focused field, none outside a field. */
export function Place({ tone }: { tone: Tone }) {
  const { column, line, mode, progress } = useMode();
  if (mode === "nav" || line === undefined || column === undefined || progress === undefined) {
    return null;
  }
  const location = `${line}:${column}`;
  if (tone === "off") {
    return (
      <>
        <Separator from="b" into="line" pointing="left" tone={tone} />
        <Section kind="b" tone={tone}>
          {progress} {location}
        </Section>
      </>
    );
  }
  return (
    <>
      <Separator from="b" into="line" pointing="left" tone={tone} />
      <Section kind="b" tone={tone}>
        {progress}
      </Section>
      <Separator from="mode" into="b" pointing="left" tone={tone} />
      <Section kind="z" tone={tone}>
        {location}
      </Section>
    </>
  );
}
