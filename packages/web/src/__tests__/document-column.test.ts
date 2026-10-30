// The document's column's stored width: a dragged width kept in the browser, nothing when it is
// not readable, and a fold that keeps a session's dragged width.
import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, test } from "vite-plus/test";
import {
  COLUMN_KEY,
  readDocumentColumn,
  showDocumentColumn,
  useDocumentColumnWidth,
  useSessionColumnWidth,
} from "../layout/documentColumnWidth.ts";

beforeEach(() => {
  window.localStorage.clear();
});

test("nothing readable is no width", () => {
  window.localStorage.setItem(COLUMN_KEY, "not json");
  expect(readDocumentColumn()).toEqual({});
  window.localStorage.setItem(COLUMN_KEY, JSON.stringify({ width: "wide" }));
  expect(readDocumentColumn()).toEqual({});
});

/** The width the browser keeps for both columns, a session's drag under the documents' least. */
const keepSessionDrag = () =>
  window.localStorage.setItem(COLUMN_KEY, JSON.stringify({ width: 320 }));

/** What the browser keeps of the columns. */
const kept = () => JSON.parse(window.localStorage.getItem(COLUMN_KEY) ?? "{}") as unknown;

test("folding and unfolding the documents' column keeps a session's dragged width", () => {
  keepSessionDrag();
  const documents = renderHook(() => useDocumentColumnWidth());
  act(() => documents.result.current.setShown(false));
  expect(kept()).toEqual({ folded: true, width: 320 });
  act(() => showDocumentColumn());
  expect(kept()).toEqual({ folded: false, width: 320 });
  documents.unmount();
  expect(renderHook(() => useSessionColumnWidth()).result.current.resizable.size).toBe(320);
});

/** Sets the window's width, as a resize does. */
function setWindowWidth(width: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  window.dispatchEvent(new Event("resize"));
}

test.each([
  [800, undefined, 400],
  [1920, undefined, 400],
  [1920, 560, 560],
  [1920, 900, 720],
])("at %i px, kept %s, the column starts at 400 px or the width dragged", (wide, kept, width) => {
  if (kept !== undefined) {
    window.localStorage.setItem(COLUMN_KEY, JSON.stringify({ width: kept }));
  }
  setWindowWidth(wide);
  expect(renderHook(() => useDocumentColumnWidth()).result.current.resizable.size).toBe(width);
});
