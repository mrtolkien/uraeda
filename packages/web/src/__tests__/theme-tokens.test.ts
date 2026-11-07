// @vitest-environment node
// The UI look decision's rules a test of the theme's tokens checks (SC-002): every text colour
// reaches 4.5:1 against its background, and borders and controls 3:1, the contrast WCAG AA asks
// for, in every shipped theme, in its own mode. It maps the themes the core ships through the same
// mapping the app draws them with (`theme/roles.ts`), derived colours included.
import { readThemes } from "uraeda-binding";
import { temporaryFolder } from "uraeda-binding/test-utils";
import { expect, test } from "vite-plus/test";
import { CONTROL_PAIRS, ratio, TEXT_PAIRS } from "../theme/pairs.ts";
import { tokensOf } from "../theme/roles.ts";

const { themes } = await readThemes(temporaryFolder("uraeda-theme-tokens"));
const SHIPPED = themes
  .filter((theme) => theme.isShipped)
  .map((theme) => [theme.id, tokensOf(theme.roles, theme.mode as "dark" | "light")] as const);

test.each(
  SHIPPED.flatMap(([id, tokens]) =>
    TEXT_PAIRS.map(([front, back]) => [id, front, back, tokens] as const),
  ),
)("in %s, %s reads at 4.5:1 on %s", (_, front, back, tokens) => {
  expect(ratio(tokens, front, back)).toBeGreaterThanOrEqual(4.5);
});

test.each(
  SHIPPED.flatMap(([id, tokens]) =>
    CONTROL_PAIRS.map(([front, back]) => [id, front, back, tokens] as const),
  ),
)("in %s, %s stands 3:1 from %s", (_, front, back, tokens) => {
  expect(ratio(tokens, front, back)).toBeGreaterThanOrEqual(3);
});
