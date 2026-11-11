// The bytes the live line does not carry, over HTTP with the device's sign-in: an image of a
// repository's files, drawn by any screen, and the address of a repository's route.
import { signal } from "nsh";
import { connection } from "./index";

/** What a request carries to sign in: the device's token, or a browser's cookie by itself. */
export function signIn(): { address: string; headers: Record<string, string> } {
  const line = connection();
  if (line === undefined) throw new Error("The app is not connected to a server.");
  const headers: Record<string, string> =
    line.signIn.by === "token" ? { authorization: `Bearer ${line.signIn.token}` } : {};
  return { address: line.address, headers };
}

/** The address of a repository's route. */
export const repositoryAddress = (repo: string, path: string) =>
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
  fetch(repositoryAddress(repo, `/images/${encoded}`), { headers: signIn().headers })
    .then(async (answer) => shown.set(answer.ok ? URL.createObjectURL(await answer.blob()) : null))
    .catch(() => {
      shown.set(null);
      drawn.delete(key);
    });
  return shown;
}
