// Which extensions are on in a repository, by the Extensions record's rows.
import { expect, test } from "vite-plus/test";
import { isOnIn } from "./ExtensionsOn.tsx";

const row = (name: string, on: ReadonlyArray<string>, onAll = false) => ({ name, on, onAll });

// Break: yours on until the record is read, flashing a place off in this repository.
test("until the rows are read, the built-ins are on and yours off", () => {
  const isOn = isOnIn(undefined, "uraeda");
  expect(["inbox", "sessions", "git"].map(isOn)).toEqual([true, true, true]);
  expect(isOn("deploy")).toBe(false);
});

// Break: a row named sessions turning Sessions off.
test("each is on where its row says, Sessions always", () => {
  const isOn = isOnIn(
    [row("deploy", ["uraeda"]), row("wiki", [], true), row("inbox", []), row("sessions", [])],
    "uraeda",
  );
  expect(["deploy", "wiki", "inbox", "sessions"].map(isOn)).toEqual([true, true, false, true]);
  expect(isOnIn([row("deploy", ["other"])], "uraeda")("deploy")).toBe(false);
});
