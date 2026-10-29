// The question a start asks once it is sent, its slug or title: Enter answers it as its button does,
// once, however often it is pressed while the start is under way, so a held Enter starts one
// feature, not two.
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vite-plus/test";
import { StartDialog } from "../StartDialog.tsx";

const QUESTION = {
  confirm: "Start",
  description: "The feature's folder and branch.",
  label: "Slug",
  title: "Start the feature",
};

test("Enter pressed again while the start runs, and its button, start nothing more", async () => {
  const started = Promise.withResolvers<string | undefined>();
  const onConfirm = vi.fn(() => started.promise);
  render(
    <StartDialog
      initial="dark-mode"
      isOpen
      onCancel={() => {}}
      onConfirm={onConfirm}
      question={QUESTION}
    />,
  );
  const field = await screen.findByRole("textbox", { name: QUESTION.label });

  for (let press = 0; press < 3; press++) {
    fireEvent.keyDown(field, { code: "Enter", key: "Enter" });
  }
  fireEvent.click(screen.getByRole("button", { name: QUESTION.confirm }));

  expect(onConfirm).toHaveBeenCalledTimes(1);
  started.resolve(undefined);
});
