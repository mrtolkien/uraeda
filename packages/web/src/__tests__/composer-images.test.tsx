import {
  ChatComposer,
  ChatComposerInput,
  type ChatComposerInputHandle,
} from "@astryxdesign/core/Chat";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { afterEach, expect, test } from "vite-plus/test";
import type { DraftImage } from "../attach/chatImages.ts";
import { ComposerImages, useFocusAfterRemove } from "../ComposerImages.tsx";
import { RepositoryContext } from "../routes.tsx";

afterEach(cleanup);

/** A synchronous store update must not consume the removal before its focus target is recorded. */
function Fixture() {
  const [images, setImages] = useState<ReadonlyArray<DraftImage>>([
    { key: "one", name: "one.png" },
    { key: "two", name: "two.png" },
  ]);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<ChatComposerInputHandle>(null);
  const focusAt = useFocusAfterRemove(box, input, images);
  return (
    <RepositoryContext value="test">
      <ChatComposer
        drawer={
          images.length > 0 ? (
            <ComposerImages
              focusAt={focusAt}
              images={images}
              onRemove={(key) =>
                flushSync(() => setImages((now) => now.filter((image) => image.key !== key)))
              }
            />
          ) : undefined
        }
        input={<ChatComposerInput handleRef={input} label="Message" />}
        ref={box}
      />
    </RepositoryContext>
  );
}

test("synchronous image removal focuses the next image, then the message", async () => {
  render(<Fixture />);

  await act(async () => fireEvent.click(screen.getByRole("button", { name: /^Remove one.png/ })));

  const next = screen.getByRole("button", { name: "Remove two.png" });
  expect(document.activeElement).toBe(next);
  await act(async () => fireEvent.click(next));
  expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Message" }));
});
