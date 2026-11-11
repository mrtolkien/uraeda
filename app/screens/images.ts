// Images over HTTP, the bytes the live line does not carry: drawn from the server with the
// device's sign-in, and sent to it: a note's (`inbox/images.ts`), one attached to a Markdown file,
// whose link the field then holds, and one kept for a chat message or a typed start. Where an image
// comes from: the system's picker, the clipboard, or files dropped from another app, read from the
// disk.
import { readFile } from "fs/promises";
import { Clipboard, Picker, signal } from "nsh";
import { connection } from "../store";
import type { ChatImage } from "../store/protocol";

/** An image picked, pasted, or dropped, not sent yet: its bytes, and a URL that shows them. */
export type Held = { blob: Blob; name: string; url: string };

/** What a request carries to sign in: the device's token, or a browser's cookie by itself. */
export function signIn(): { address: string; headers: Record<string, string> } {
  const line = connection();
  if (line === undefined) throw new Error("The app is not connected to a server.");
  const headers: Record<string, string> =
    line.signIn.by === "token" ? { authorization: `Bearer ${line.signIn.token}` } : {};
  return { address: line.address, headers };
}

/** The address of a repository's route. */
export const at = (repo: string, path: string) =>
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

/** Sends one image to the server's `/attach`, and gives its answer, or rejects with the refusal. */
async function attach<T>(repo: string, query: string, image: Held): Promise<T> {
  const body = new FormData();
  body.append("file", image.blob, image.name || "image.png");
  const name = `name=${encodeURIComponent(image.name)}`;
  const answer = await fetch(at(repo, `/attach?${query}&${name}`), {
    body,
    headers: signIn().headers,
    method: "POST",
  });
  const said = (await answer.json().catch(() => ({}))) as { error?: string };
  if (!answer.ok) {
    throw new Error(
      (said.error ?? `The server answered ${answer.status}.`).replace(/^refused: /, ""),
    );
  }
  return said as T;
}

/** Attaches an image to the Markdown file at `path`: the link to put in its text. */
export const attachToFile = (repo: string, path: string, image: Held) =>
  attach<{ link: string; path: string }>(repo, `path=${encodeURIComponent(path)}`, image);

/** Keeps an image for a chat message or a typed start: what the start or the message takes. */
export const keepForChat = (repo: string, image: Held) => attach<ChatImage>(repo, "chat=1", image);
