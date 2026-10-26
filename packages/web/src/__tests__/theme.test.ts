// The colour scheme's stored format: Mocha and Latte, the old `dark` and `light` read as them, and
// anything else, or nothing stored, the system's.
import { expect, test } from "vite-plus/test";
import { storedScheme } from "../theme.tsx";

test.each([
  ["mocha", "mocha"],
  ["latte", "latte"],
  // An earlier pick of dark reads as Mocha, and light as Latte.
  ["dark", "mocha"],
  ["light", "latte"],
  ["system", "system"],
  [null, "system"],
  ["", "system"],
  ["solarized", "system"],
])("the stored value %j reads as %s", (value, scheme) => {
  expect(storedScheme(value)).toBe(scheme);
});
