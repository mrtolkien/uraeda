// A note's images over HTTP, the bytes the live line does not carry: drawn from the server with
// the device's sign-in, and sent with `POST /r/<name>/inbox/note-image`. Where an image comes from:
// the system's picker, the clipboard, or files dropped from another app, read from the disk.
import { readFile } from "fs/promises";
import { Clipboard, Picker, signal } from "nsh";
import { connection } from "../../store";

/** An image picked, pasted, or dropped, not sent yet: its bytes, and a URL that shows them. */
export type Held = { blob: Blob; name: string; url: string };

/** What a request carries to sign in: the device's token, or a browser's cookie by itself. */
function signIn(): { address: string; headers: Record<string, string> } {
  const line = connection();
  if (line === undefined) throw new Error("The app is not connected to a server.");
  const headers: Record<string, string> =
    line.signIn.by === "token" ? { authorization: `Bearer ${line.signIn.token}` } : {};
  return { address: line.address, headers };
}

/** The address of a repository's route. */
const at = (repo: string, path: string) =>
  `${signIn().address}/r/${encodeURIComponent(repo)}${path}`;

/** The images drawn already, by repository and path: one request each per run of the app. */
const drawn = new Map<string, ReturnType<typeof signal<string | null | undefined>>>();

/**
 * An image of the repository under `specs/`, by its path from the top level, as a URL an `Image`
 * shows: `undefined` while it comes, `null` when the server has none.
 */
export function imageOf(repo: string, path: string): () => string | null | undefined {
  const key = `${repo}\n${path}`;
  const known = drawn.get(key);
  if (known !== undefined) return known;
  const shown = signal<string | null | undefined>(undefined);
  drawn.set(key, shown);
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  fetch(at(repo, `/images/${encoded}`), { headers: signIn().headers })
    .then(async (answer) => shown.set(answer.ok ? URL.createObjectURL(await answer.blob()) : null))
    .catch(() => {
      shown.set(null);
      drawn.delete(key);
    });
  return shown;
}

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
  const answer = await fetch(at(repo, `/inbox/note-image?${names}`), {
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

/** Holds a blob as an image to send, with a URL that shows it. */
const hold = (blob: Blob, name: string): Held => ({ blob, name, url: URL.createObjectURL(blob) });

/** The images the human picks in the system's picker: none when they cancel. */
export async function pickImages(): Promise<Array<Held>> {
  const picked = await Picker.pickImages({ limit: 10, multiple: true });
  return picked.map((one) => hold(one.file, one.file.name));
}

/** The clipboard's image, when it holds one: a screenshot, an image copied in a browser. */
export async function pastedImage(): Promise<Held | undefined> {
  if (!(await Clipboard.hasImage())) return undefined;
  const image = await Clipboard.readImage();
  if (image === null) return undefined;
  const blob = await (await fetch(image.url)).blob();
  return hold(blob, "");
}

/** The images among files dropped from another app, by their `file:` URLs, read from the disk. */
export async function droppedImages(uris: ReadonlyArray<string>): Promise<Array<Held>> {
  const paths = uris
    .map((uri) => decodeURIComponent(new URL(uri).pathname))
    .filter((path) => /\.(png|jpe?g|gif|webp|bmp|heic|avif)$/i.test(path));
  const read = await Promise.all(paths.map((path) => readFile(path)));
  return read.map((bytes, index) => hold(new Blob([bytes]), paths[index]!.split("/").pop() ?? ""));
}
