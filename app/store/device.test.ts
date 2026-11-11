// Run by `nsh test`, without a display: what the app keeps on a device, on Native Shell's storage,
// which this file's engine holds in memory.
import { effect, Storage } from "nsh";
import { expect, test } from "nsh/test";
import { deviceStore } from "./device";

/** The keys of a device, as the app's table declares its own. */
type Keys = {
  theme: "dark" | "light";
  [draft: `unsaved:${string}`]: { text: string };
};

test("a choice kept on the device comes back after a restart", async () => {
  await Storage.clear();
  const device = deviceStore<Keys>();
  await device.load();
  expect(device.get("theme")).toBe(undefined);
  const seen: Array<string | undefined> = [];
  effect(() => {
    seen.push(device.get("theme"));
  });

  // A choice is read back at once, by who reads it already too.
  device.set("theme", "dark");
  device.set("unsaved:inbox", { text: "half a note" });
  expect(device.get("theme")).toBe("dark");

  // A restart: the same storage, read again.
  const restarted = deviceStore<Keys>();
  expect(restarted.get("theme")).toBe(undefined);
  await restarted.load();
  expect(restarted.get("theme")).toBe("dark");
  expect(restarted.get("unsaved:inbox")).toEqual({ text: "half a note" });
  expect(restarted.get("unsaved:other")).toBe(undefined);

  // A choice taken back is gone after the next start.
  restarted.set("theme", undefined);
  const again = deviceStore<Keys>();
  await again.load();
  expect(again.get("theme")).toBe(undefined);
  expect(again.get("unsaved:inbox")).toEqual({ text: "half a note" });
  expect(seen).toEqual([undefined, "dark"]);
});

test("a choice made while the device is read wins over the one kept", async () => {
  await Storage.clear();
  await Storage.setItem("theme", JSON.stringify("light"));
  // What something else wrote there, which is no value of the app's, reads as nothing kept.
  await Storage.setItem("unsaved:inbox", "{half");
  const device = deviceStore<Keys>();
  const loading = device.load();
  device.set("theme", "dark");
  await loading;
  expect(device.get("theme")).toBe("dark");
  expect(device.get("unsaved:inbox")).toBe(undefined);
});

test("a value the storage refuses stays for the run, and the device says it is full", async () => {
  await Storage.clear();
  const device = deviceStore<Keys>();
  await device.load();
  expect(device.full()).toBe(false);
  // Past the 5 MB an app may keep.
  const text = "x".repeat(6 * 1024 * 1024);
  device.set("unsaved:inbox", { text });
  await Storage.getItem("theme");
  expect(device.full()).toBe(true);
  expect(device.get("unsaved:inbox")?.text.length).toBe(text.length);
  expect(await Storage.getItem("unsaved:inbox")).toBe(null);

  // A value that fits is kept again.
  device.set("unsaved:inbox", { text: "short" });
  await Storage.getItem("theme");
  expect(device.full()).toBe(false);
});
