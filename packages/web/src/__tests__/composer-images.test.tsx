import {
  ChatComposer,
  ChatComposerInput,
  type ChatComposerInputHandle,
} from "@astryxdesign/core/Chat";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { afterEach, expect, test } from "vite-plus/test";
import type { DraftImage } from "../attach/chatImages.ts";
import { ComposerImages, useFocusAfterRemove } from "../ComposerImages.tsx";
import { RepositoryContext } from "../routes.tsx";

afterEach(cleanup);

/** Saves the fixture's images, as their uploads end: set by the fixture drawn last. */
let saveAll: () => void = () => undefined;

/** A synchronous store update must not consume the removal before its focus target is recorded. */
function Fixture({ drawFirst = false }: { drawFirst?: boolean }) {
  const [images, setImages] = useState<ReadonlyArray<DraftImage>>([
    { key: "one", name: "one.png" },
    { key: "two", name: "two.png" },
  ]);
  useEffect(() => {
    saveAll = () =>
      setImages((now) =>
        now.map(({ key, name }) => ({
          image: { height: 1, id: `${key}.png`, width: 1 },
          key,
          name,
        })),
      );
  }, []);
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
              onRemove={(key) => {
                if (drawFirst) {
                  // A draw of the same images, as one just saved, lands before the removal.
                  flushSync(() => setImages((now) => [...now]));
                }
                flushSync(() => setImages((now) => now.filter((image) => image.key !== key)));
              }}
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

test("a draw of the same images before the removal does not take the focus first", async () => {
  render(<Fixture drawFirst />);

  await act(async () => fireEvent.click(screen.getByRole("button", { name: /^Remove one.png/ })));

  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Remove two.png" }));
});

test("a removal clicked before an earlier change's effects ran focuses the next image", async () => {
  render(<Fixture />);
  const remove = screen.getByRole("button", { name: /^Remove one.png/ });
  // The click lands once the saved images are drawn, before React ran that draw's effects, as a
  // loaded machine lets it.
  const clicked = new Promise<void>((resolve) => {
    const observer = new MutationObserver(() => {
      observer.disconnect();
      fireEvent.click(remove);
      resolve();
    });
    observer.observe(document.body, { attributes: true, childList: true, subtree: true });
  });

  setTimeout(saveAll);
  await clicked;

  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Remove two.png" })),
  );
});
