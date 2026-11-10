// The form's saves of an existing job: each field's change is a patch applied against the latest
// accepted job and the latest name, queued while another save is in flight, never a whole stale job;
// the controls move at once and a refusal puts them back; a draft is cleared by a save only when it
// still holds the text sent. The saves are answered by hand, so no test waits for time.
import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { atWidth, fieldText, type } from "./helpers.tsx";
import { INPUT, open } from "./job-page-fixtures.tsx";

beforeEach(() => atWidth(1440));
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

const field = (name: string) => screen.getByRole("textbox", { name });
const leave = (element: HTMLElement) => act(async () => void fireEvent.focusOut(element));

/** A save answered by hand: `answer` resolves the oldest one still waiting. */
function slowSaves() {
  const waiting: Array<(refusal: string | undefined) => void> = [];
  const onSave = vi.fn(
    (_input: unknown, _name: string) =>
      new Promise<string | undefined>((resolve) => void waiting.push(resolve)),
  );
  const answer = async (refusal?: string) => {
    await waitFor(() => expect(waiting.length).toBeGreaterThan(0));
    await act(async () => void waiting.shift()?.(refusal));
  };
  return { answer, onSave };
}

const reportOnly = () => screen.getByRole("switch", { name: "Report only" }) as HTMLInputElement;

test("a change while a save is in flight is applied on what that save wrote", async () => {
  const { answer, onSave } = slowSaves();
  open(onSave);
  await type(field("Prompt"), "Upgrade them all.");
  await leave(field("Prompt"));
  fireEvent.click(reportOnly());
  // The second waits for the first: it is queued, built on the first's prompt.
  expect(onSave).toHaveBeenCalledTimes(1);
  await answer();
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
  expect(onSave).toHaveBeenLastCalledWith(
    { ...INPUT, prompt: "Upgrade them all.", reportOnly: true },
    "Dependencies",
  );
});

test("two changes of one row are both saved, the second on the first", async () => {
  const { answer, onSave } = slowSaves();
  open(onSave);
  fireEvent.click(screen.getByRole("radio", { name: "Weekly" }));
  // The control moved at once, with its day.
  fireEvent.click(await screen.findByRole("radio", { name: "Wed" }));
  await answer();
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
  expect(onSave).toHaveBeenNthCalledWith(1, { ...INPUT, schedule: "monday 03:00" }, "Dependencies");
  expect(onSave).toHaveBeenNthCalledWith(
    2,
    { ...INPUT, schedule: "wednesday 03:00" },
    "Dependencies",
  );
});

test("a save after a rename goes to the new name", async () => {
  const { answer, onSave } = slowSaves();
  open(onSave);
  await type(field("Name"), " Upgrades ");
  await leave(field("Name"));
  fireEvent.click(reportOnly());
  await answer();
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
  expect(onSave).toHaveBeenNthCalledWith(1, { ...INPUT, name: " Upgrades " }, "Dependencies");
  expect(onSave).toHaveBeenNthCalledWith(
    2,
    { ...INPUT, name: "Upgrades", reportOnly: true },
    "Upgrades",
  );
});

test("a switch moves at once, and a refusal puts it back under its field", async () => {
  const { answer, onSave } = slowSaves();
  open(onSave);
  fireEvent.click(reportOnly());
  expect(reportOnly().checked).toBe(true);
  await answer("A job named “Dependencies” exists already.");
  expect(await screen.findByText("A job named “Dependencies” exists already.")).toBeTruthy();
  expect(reportOnly().checked).toBe(false);
});

test("a line typed after its Enter keeps its text when the first save is accepted", async () => {
  const { answer, onSave } = slowSaves();
  open(onSave);
  await type(field("Time"), "04:30");
  await act(async () => void fireEvent.keyDown(field("Time"), { key: "Enter" }));
  await type(field("Time"), "04:45");
  await answer();
  expect(fieldText(field("Time"))).toBe("04:45");
  // Leaving it saves the newer text, on the first.
  await leave(field("Time"));
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
  expect(onSave).toHaveBeenLastCalledWith({ ...INPUT, schedule: "daily 04:45" }, "Dependencies");
});
