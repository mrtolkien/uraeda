// `atSize`, which the browser tests declare their size with (US4.2, US4.3): a test of the other size
// is skipped before any hook runs, so it takes no repository and costs nothing.
import { afterAll, beforeEach, describe, expect, test } from "vite-plus/test";
import { atSize } from "./helpers.tsx";

/** The tests the file's hooks ran for, and the tests that ran. */
let hooked = 0;
let ran = 0;

beforeEach(() => {
  hooked += 1;
});

afterAll(() => {
  // At each size: its own test, the test of both sizes, and the two of a misplaced call.
  expect({ hooked, ran }).toEqual({ hooked: 4, ran: 4 });
});

describe("at the phone's size", () => {
  atSize("phone");

  test("runs only on the phone", () => {
    ran += 1;
    expect(window.innerWidth).toBeLessThan(768);
  });
});

describe("at the desktop's size", () => {
  atSize("desktop");

  test("runs only on the desktop", () => {
    ran += 1;
    expect(window.innerWidth).toBeGreaterThanOrEqual(768);
  });
});

describe("at both sizes", () => {
  atSize("both");

  test("runs at each size", () => {
    ran += 1;
  });
});

/** What a call made after its scope's first test threw. */
let late: unknown;

describe("a call after a test of its scope", () => {
  test("throws: it can no longer skip that test", () => {
    ran += 1;
    expect(String(late)).toContain("call atSize before the tests of its file or describe block");
  });

  try {
    atSize("both");
  } catch (error) {
    late = error;
  }
});

describe("a call inside a test", () => {
  test("throws: the test is already running", () => {
    ran += 1;
    expect(() => atSize("both")).toThrow(
      "call atSize before the tests of its file or describe block",
    );
  });
});
