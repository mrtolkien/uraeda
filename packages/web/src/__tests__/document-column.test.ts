// The document's column's one width: a third of the window, between 400 and 600 px, until dragged;
// a dragged width, kept in the browser, between 400 and 720 px, also when the browser keeps one
// outside them (Review focus 6).
import { beforeEach, expect, test } from "vite-plus/test";
import { autoWidth, COLUMN_KEY, readDocumentColumn } from "../layout/documentColumnWidth.ts";

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
