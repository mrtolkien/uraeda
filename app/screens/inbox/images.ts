// A note's images, sent with `POST /r/<name>/inbox/note-image`; the rest of an image's way, drawn,
// picked, pasted, or dropped, is every screen's (`../images.ts`, `imageOf` in the store).
import { repositoryAddress, signIn } from "../../store";
import type { Held } from "../images";

/** What a note's images are sent with: a new note's text and place, or the note that gets them. */
export type NoteImages =
  | { about?: string | null; category?: string | null; text: string }
  | { id: string };

/**
 * Sends images to the inbox in one write, all or none: a new note with them, or more for a note.
 * Resolves with the server's answer, or rejects with its refusal's words.
 */
export async function sendImages(
  repo: string,
  hash: string,
  to: NoteImages,
  images: ReadonlyArray<Held>,
): Promise<{ change: unknown; file: string }> {
  const body = new FormData();
  body.append("hash", hash);
  if ("id" in to) {
    body.append("id", to.id);
  } else {
    body.append("text", to.text);
    if (to.category != null) body.append("category", to.category);
    if (to.about != null) body.append("about", to.about);
  }
  for (const image of images) body.append("file", image.blob, image.name || "image.png");
  const names = images.map((image) => `name=${encodeURIComponent(image.name)}`).join("&");
  const { headers } = signIn();
  const answer = await fetch(repositoryAddress(repo, `/inbox/note-image?${names}`), {
    body,
    headers,
    method: "POST",
  });
  const said = (await answer.json().catch(() => ({}))) as { error?: string };
  if (!answer.ok) {
    throw new Error(
      (said.error ?? `The server answered ${answer.status}.`).replace(/^refused: /, ""),
    );
  }
  return said as { change: unknown; file: string };
}
