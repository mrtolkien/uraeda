// A message sent in a session draws its markdown in the fonts the editor wrote it in: its code in
// the code font, its headings in the heading font, the rest in markdown prose's.
import { render } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { MessageBody } from "../MessageBody.tsx";

// Break: draw `item.text` whole in `MessageBody`.
test("a sent message's code and headings are in their fonts", () => {
  const text = "# Plan\n\nRun `vp check`, then:\n\n```sh\nvp test\n```";
  const { container } = render(<MessageBody item={{ text }} pending={false} />);
  const inFont = (font: string) =>
    [...container.querySelectorAll(`[data-font="${font}"]`)].map((run) => run.textContent);
  expect(inFont("code")).toEqual(["`vp check`", "```sh", "vp test", "```"]);
  expect(inFont("heading")).toEqual(["# Plan"]);
  expect(container.textContent).toBe(text);
});
