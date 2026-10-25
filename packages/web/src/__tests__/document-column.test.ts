// The document's column's one width: a third of the window, between 400 and 600 px, until dragged;
// a dragged width, kept in the browser, between 400 and 720 px, also when the browser keeps one
// outside them (Review focus 6). A session's column, narrower at semi-wide (C2), so the chat keeps
// the weight, and the documents' column keeps its 400 px.
import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, test } from "vite-plus/test";
import {
  autoWidth,
  COLUMN_KEY,
  readDocumentColumn,
  sessionAutoWidth,
  showDocumentColumn,
  useDocumentColumnWidth,
  useSessionColumnWidth,
} from "../layout/documentColumnWidth.ts";

beforeEach(() => {
  window.localStorage.clear();
});

test("the width before a drag is a third of the window, between 400 and 600 px", () => {
  expect(autoWidth(1440)).toBe(480);
  expect(autoWidth(1205)).toBe(402);
  expect(autoWidth(900)).toBe(400);
  expect(autoWidth(2400)).toBe(600);
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

test("the session column is narrower than the documents' at semi-wide (C2)", () => {
  expect(sessionAutoWidth(1000)).toBe(300);
  expect(sessionAutoWidth(1279)).toBe(360);
  expect(autoWidth(1000)).toBe(400);
});

/** The width the browser keeps for both columns, a session's drag under the documents' least. */
const keepSessionDrag = () =>
  window.localStorage.setItem(COLUMN_KEY, JSON.stringify({ width: 320 }));

/** What the browser keeps of the columns. */
const kept = () => JSON.parse(window.localStorage.getItem(COLUMN_KEY) ?? "{}") as unknown;

test("a session's dragged width reads as itself in Session, and as 400 px in the documents'", () => {
  keepSessionDrag();
  expect(renderHook(() => useSessionColumnWidth()).result.current.resizable.size).toBe(320);
  expect(renderHook(() => useDocumentColumnWidth()).result.current.resizable.size).toBe(400);
});

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
