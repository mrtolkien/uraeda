// The status line's Vim mode (US3, the Text editing decision's "The status line MUST name the Vim
// mode while Vim is on"): named with Vim on, left out with Vim off, and read out once as it changes
// in a field, which a sighted review of the line would not show. Its look is reviewed in the
// sandbox.
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { setFocused, setMode } from "../fields/editor/modeStore.ts";
import { setVimOn } from "../fields/editor/vim/load.ts";
import { KeysProvider } from "../keys/registry.tsx";
import { RepositoryContext } from "../routes.tsx";
import { StatusLine } from "../shell/StatusLine.tsx";

const announce = vi.fn();

vi.mock("@astryxdesign/core/hooks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@astryxdesign/core/hooks")>()),
  useAnnounce: () => announce,
}));

vi.mock("../sessionData.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../sessionData.ts")>()),
  useNavigation: () => ({ sessionList: null, workspace: null }),
}));

afterEach(() => {
  act(() => {
    setFocused(null);
    setVimOn(false);
  });
  announce.mockClear();
  cleanup();
});

function show() {
  render(
    <RepositoryContext.Provider value="uraeda">
      <KeysProvider>
        <StatusLine isNarrow={false} slot={null} />
      </KeysProvider>
    </RepositoryContext.Provider>,
  );
}

/** The status line's text. */
const line = () => screen.getByRole("contentinfo", { name: "Status line" }).textContent ?? "";

// Break: the mode left out of the line with Vim on, or shown with Vim off.
test("with Vim on the line opens with the mode, NAV outside a field; with Vim off it has none", () => {
  act(() => setVimOn(true));
  show();
  expect(line()).toMatch(/^NAV/);
  act(() => setFocused({ mode: "normal" }));
  expect(line()).toMatch(/^NORMAL/);

  act(() => setVimOn(false));
  expect(line()).not.toMatch(/NORMAL|NAV/);
});

// Break: a mode change no screen reader hears, or one it hears again on each focus.
test("a mode's change in a field is read out once, politely, and a field's focus is not", () => {
  act(() => setVimOn(true));
  show();
  act(() => setFocused({ mode: "normal" }));
  expect(announce).not.toHaveBeenCalled();
  act(() => setMode("insert"));
  expect(announce).toHaveBeenCalledExactlyOnceWith("Insert mode", "polite");
  act(() => setFocused(null));
  expect(announce).toHaveBeenCalledOnce();
});
