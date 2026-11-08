// The settings form of an extension for one repository: it shows that repository's own values over
// the shared ones, and clears one back to the shared value.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vite-plus/test";
import { RepositoryContext, RepositoryPathContext } from "../routes.tsx";
import { ExtensionForm } from "../settings/ExtensionForm.tsx";
import { sampleExtensions } from "../settings/sampleExtensions.ts";

const wiki = sampleExtensions.extensions.find((row) => row.name === "wiki")!;

/** The "Newest first" switch. */
const newest = () => screen.getByRole("switch", { name: "Newest first" }) as HTMLInputElement;

/** The form of the wiki, which `uraeda` sets "Newest first" off for, with `uraeda` picked. */
async function inUraeda() {
  const setSetting = vi.fn(async () => undefined);
  render(
    <RepositoryContext value="uraeda">
      <RepositoryPathContext value="/repo">
        <ExtensionForm repositories={["uraeda", "other"]} row={wiki} setSetting={setSetting} />
      </RepositoryPathContext>
    </RepositoryContext>,
  );
  // For every repository: the shared value, on.
  expect(newest().checked).toBe(true);
  expect(screen.queryByRole("button", { name: "Use the shared value" })).toBeNull();
  await act(async () => {
    fireEvent.click(screen.getByRole("combobox", { name: /settings for/ }));
  });
  await act(async () => {
    fireEvent.click(await screen.findByRole("option", { name: "uraeda" }));
  });
  return setSetting;
}

// Break: the form showing the values for every repository whatever the repository picked.
test("a repository's own value shows, and clears back to the shared one", async () => {
  const setSetting = await inUraeda();
  expect(newest().checked).toBe(false);
  expect(screen.getByText("Set for uraeda only.")).toBeTruthy();

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Use the shared value" }));
  });
  expect(setSetting).toHaveBeenCalledWith("wiki", "uraeda", "byDate", "null");
});
