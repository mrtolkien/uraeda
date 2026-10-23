// The UI look decision: a harness is marked by Codicons' drawing of its mark where Codicons has
// one, and by a neutral glyph otherwise; an unknown kind, the spec's edge case, by the generic
// agent glyph, never an empty space (Review focus 5).
import { Theme } from "@astryxdesign/core/theme";
import { render, screen } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { HarnessMark, harnessMark } from "../HarnessMark.tsx";
import { uraedaTheme } from "../theme/built/uraeda.js";
import { uraedaIcons } from "../theme/icons.ts";

const CASES = [
  { icon: "uraeda:harness-claude", kind: "claude", name: "Claude Code" },
  { icon: "uraeda:harness-openai", kind: "codex", name: "Codex" },
  { icon: "uraeda:harness-agent", kind: "fake", name: "Fake agent" },
  { icon: "uraeda:harness-agent", kind: "pi", name: "Pi" },
  { icon: "uraeda:harness-agent", kind: "aider", name: "aider" },
];

test.each(CASES)("$kind is marked as $name, by a drawn glyph", ({ icon, kind, name }) => {
  expect(harnessMark(kind)).toEqual({ icon, name });
  expect(Object.hasOwn(uraedaIcons, icon)).toBe(true);
});

test.each(CASES)("$kind's mark is named $name", ({ kind, name }) => {
  render(
    <Theme theme={uraedaTheme}>
      <HarnessMark kind={kind} />
    </Theme>,
  );
  expect(screen.getByRole("img", { name })).toBeTruthy();
});
