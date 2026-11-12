// Files dropped on the app in a browser. Native Shell 0.5.0's web runtime passes no drop to the
// app's views (`onFileDrop`), and the browser's own answer to a dropped file is to open it in
// place of the app, which loses what was typed. So the page keeps the drop, and says the ways an
// image does reach the app there: a paste, and the picker.
import { cleanup, platform, signal } from "nsh";
import { page } from "./page";
import { Text } from "../ui/controls";
import { Toast } from "../ui/surfaces";

/** How long the words stay. */
const SHOWN = 6000;

type DragEvent = { dataTransfer: { types: ReadonlyArray<string> } | null; preventDefault(): void };

/** Whether a drag carries files. */
const files = (event: DragEvent) => event.dataTransfer?.types.includes("Files") === true;

/** Keeps a drag of files from the browser, so it may be dropped. */
const over = (event: DragEvent) => {
  if (files(event)) event.preventDefault();
};

/** The toast that answers a drop, in a browser: nothing elsewhere. */
export function DroppedFiles() {
  if (platform.os !== "web") return null;
  const dropped = signal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const drop = (event: DragEvent) => {
    if (!files(event)) return;
    event.preventDefault();
    dropped.set(true);
    clearTimeout(timer);
    timer = setTimeout(() => dropped.set(false), SHOWN);
  };
  page().addEventListener("dragover", over);
  page().addEventListener("drop", drop);
  cleanup(() => {
    clearTimeout(timer);
    page().removeEventListener("dragover", over);
    page().removeEventListener("drop", drop);
  });
  return (
    <If when={dropped()}>
      <Toast icon="image-plus" title="Dropped files stay out in a browser">
        <Text>Paste the image with Ctrl+V, or attach it with the picker.</Text>
      </Toast>
    </If>
  );
}
