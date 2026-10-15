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
  // At each size: its own test, and the test of both sizes.
  expect({ hooked, ran }).toEqual({ hooked: 2, ran: 2 });
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
