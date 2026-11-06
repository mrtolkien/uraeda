// A one-line field is a control's height on a touch screen, 44 px, as Astryx's controls are there:
// its room above and below its text grows under `pointer: coarse`, and nowhere else.
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { afterEach, expect, test } from "vite-plus/test";
import { editorTheme, sizeTheme } from "./theme.ts";

const views: Array<EditorView> = [];
afterEach(() => {
  for (const view of views.splice(0)) {
    view.destroy();
  }
});

/** The CSS CodeMirror mounted for a one-line field, its rules' text. */
function lineRules() {
  const view = new EditorView({
    parent: document.body,
    state: EditorState.create({ extensions: [editorTheme, sizeTheme("line", 1)] }),
  });
  views.push(view);
  const rules: Array<string> = [];
  for (const sheet of [...document.styleSheets, ...document.adoptedStyleSheets]) {
    for (const rule of sheet.cssRules) {
      rules.push(rule.cssText);
    }
  }
  return rules.join("\n");
}

// Break: a one-line field back to 40 px on the phone.
test("a one-line field is a control's height under a coarse pointer, its text in its middle", () => {
  const css = lineRules();
  const touch = css.slice(css.indexOf("@media (pointer: coarse)"));
  expect(touch).toContain("--size-element-md");
  expect(touch).toMatch(
    /min-height: calc\(var\(--size-element-md\) - 2 \* var\(--border-width, 1px\)\)/,
  );
  // Its room, as the frame's: a control's height less the frame, and its line, halved. The test's
  // DOM drops a nested calc from its parsed rules, so the style's own text is read.
  const text = [...document.querySelectorAll("style")].map((style) => style.textContent).join("\n");
  expect(text).toContain(
    "padding: calc((var(--size-element-md) - 2 * var(--border-width, 1px) - 1.5em) / 2) 0",
  );
});
