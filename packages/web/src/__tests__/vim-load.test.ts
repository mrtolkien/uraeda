// The Vim engine's chunk is requested only with the switch on and a fine main pointer (SC-004, the
// plan's review focus 7), and a command the engine refuses comes back with its line.
import { expect, test, vi } from "vite-plus/test";
import { loadVim } from "../fields/editor/vim/load.ts";

/** How many times the engine's chunk was imported. */
const imported = vi.hoisted(() => ({ count: 0 }));

vi.mock("../fields/editor/vim/vim.ts", async (actual) => {
  imported.count += 1;
  return actual();
});

test("the engine loads only with the switch on and a fine pointer", async () => {
  // Breaks if the chunk is requested for everyone, or on a touch screen.
  for (const [on, fine] of [
    [false, true],
    [true, false],
    [false, false],
  ]) {
    expect(await loadVim({ on: on! }, { fine: fine! })).toBeUndefined();
  }
  expect(imported.count).toBe(0);

  const layer = await loadVim({ on: true }, { fine: true });
  expect(layer?.runCommands).toBeTypeOf("function");
  expect(imported.count).toBe(1);
});

test("a refused command gives its line and the engine's message", async () => {
  const { runCommands } = await import("../fields/editor/vim/vim.ts");

  // Breaks if an error loses its line, or the engine's own message.
  expect(runCommands(["imap jj <Esc>", "nmpa Q dd"])).toEqual([
    'Line 2: Not an editor command ":nmpa Q dd"',
  ]);
});

test("the line motions follow the lines shown", async () => {
  const { runCommands } = await import("../fields/editor/vim/vim.ts");
  const { EditorView } = await import("@codemirror/view");
  const { getCM, Vim, vim } = await import("@replit/codemirror-vim");
  runCommands([]);
  const view = new EditorView({ doc: "one\ntwo\nthree", extensions: vim() });
  const cm = getCM(view)!;
  // The motion the engine ran last, by its name.
  const motion = (typed: ReadonlyArray<string>) => {
    for (const key of typed) {
      Vim.handleKey(cm, key, "user");
    }
    return (cm.state.vim as { lastMotion?: { name: string } }).lastMotion?.name;
  };

  // Breaks if `j`, `k`, `0`, or `$` moves by Vim's lines, which skips a wrapped line's rest.
  expect(motion(["j"])).toBe("moveByDisplayLines");
  expect(motion(["k"])).toBe("moveByDisplayLines");
  expect(motion(["$"])).toBe("moveToEndOfDisplayLine");
  expect(motion(["0"])).toBe("moveToStartOfDisplayLine");
  expect(motion(["v", "j"])).toBe("moveByDisplayLines");
  view.destroy();
});
