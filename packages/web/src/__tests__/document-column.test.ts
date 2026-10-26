// The document's column's stored width: a dragged width, kept in the browser, between 400 and
// 720 px, also when the browser keeps one outside them (Review focus 6), and a fold that keeps a
// session's dragged width.
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

test("a stored width is clamped", () => {
  window.localStorage.setItem(COLUMN_KEY, JSON.stringify({ width: 900 }));
  expect(readDocumentColumn().width).toBe(720);
  window.localStorage.setItem(COLUMN_KEY, JSON.stringify({ width: 200 }));
  expect(readDocumentColumn().width).toBe(400);
  window.localStorage.setItem(COLUMN_KEY, JSON.stringify({ width: 560 }));
  expect(readDocumentColumn().width).toBe(560);
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
