// The UI layout decision's three width classes, from the theme's breakpoints: narrow under 768 px,
// semi-wide from 768 px, and wide from 1280 px. The hook and the reading of the moment agree. A
// crossing, which happy-dom's media queries do not announce, is the browser tests' (`layout.test`).
import { renderHook } from "@testing-library/react";
import { describe, expect, test } from "vite-plus/test";
import { isNarrow, useWidthClass, widthClassNow } from "../layout/useWidthClass.ts";
import { atWidth } from "./helpers.tsx";

describe("the width class", () => {
  test.each([
    { expected: "narrow", width: 402 },
    { expected: "narrow", width: 767 },
    { expected: "semi", width: 768 },
    { expected: "semi", width: 1205 },
    { expected: "semi", width: 1279 },
    { expected: "wide", width: 1280 },
    { expected: "wide", width: 1440 },
  ] as const)("$width px is $expected", ({ expected, width }) => {
    atWidth(width);
    const { result } = renderHook(() => useWidthClass());
    expect(result.current).toBe(expected);
    expect(widthClassNow()).toBe(expected);
    expect(isNarrow(result.current)).toBe(expected === "narrow");
  });
});
