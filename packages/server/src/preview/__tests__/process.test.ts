// Why a Storybook that ended says it did: its error line, without Storybook's frame.
import { expect, test } from "vite-plus/test";
import { lastReason } from "../process.ts";

test("names the last error line, of any error kind, over Storybook's closing line", () => {
  const lines = [
    "│",
    '▲  Failed to load preset: ".storybook/main.ts"',
    "■  SyntaxError: Unexpected token '}'",
    "│",
    "└  Storybook exited with an error",
  ];

  expect(lastReason(lines)).toBe("SyntaxError: Unexpected token '}'");
  expect(lastReason(["Error: first", "TypeError: second", "done"])).toBe("TypeError: second");
});

test("names the last line when no line is an error, and nothing for a bare frame", () => {
  expect(lastReason(["Storybook ready on http://127.0.0.1:1/"])).toBe(
    "Storybook ready on http://127.0.0.1:1/",
  );
  expect(lastReason(["│", "└"])).toBeUndefined();
});
