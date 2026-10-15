// Adding a folder's repository as the server starts or as a second start hands it over: the start
// and the route `POST /open` share it.
import { isAbsolute } from "node:path";
import { Hono } from "hono";
import type { Binding } from "./fate/context.ts";
import type { FateVariables } from "./fate.ts";
import type { Hosts } from "./repositories.ts";

/** A second start's request: its absolute folder, and whether `--repo` or `URAEDA_REPO` gave it. */
export type OpenRequest = { folder: string; given: boolean };

/** The running server's answer: its version, which marks it as Uraeda, and the page to open. */
export type OpenAnswer = { uraeda: string; url: string };

/** The `code` of `openFolder`'s error for a given folder outside git, which stops the start. */
export const NOT_A_REPOSITORY = "NOT_A_REPOSITORY";

/**
 * Adds the main checkout of `folder` to the list, or touches it when listed, and returns its page,
 * `/r/<name>/`; `/` when the folder is not in git and was not given. Rejects with
 * `<folder> is not a git repository`, its `code` `NOT_A_REPOSITORY`, when it was given. Reloads
 * the hosts before returning, when they are open, so the page is served at once.
 */
export async function openFolder(
  { binding, dataDir, hosts }: { binding: Binding; dataDir: string; hosts?: Hosts },
  { folder, given }: OpenRequest,
): Promise<{ url: string }> {
  const root = await binding.mainRoot(folder).catch(() => null);
  if (root === null && given) {
    throw Object.assign(new Error(`${folder} is not a git repository`), {
      code: NOT_A_REPOSITORY,
    });
  }
  if (root === null) {
    return { url: "/" };
  }
  const { repository } = await binding.addRepository(dataDir, root);
  await hosts?.reload();
  return { url: `/r/${encodeURIComponent(repository.name)}/` };
}

/** The request's body as an `OpenRequest`, or null without an absolute `folder`. */
async function openRequest(request: Request): Promise<OpenRequest | null> {
  const body = (await request.json().catch(() => null)) as Partial<OpenRequest> | null;
  if (typeof body?.folder !== "string" || !isAbsolute(body.folder)) {
    return null;
  }
  return { folder: body.folder, given: body.given === true };
}

/**
 * `POST /open`: 200 with an `OpenAnswer`, or 400 with `{ error }` for a body without an absolute
 * folder, a given folder outside git, or a list the core refuses to change.
 */
export function openRoute() {
  const route = new Hono<{ Variables: FateVariables }>();
  route.post("/open", async (context) => {
    const request = await openRequest(context.req.raw);
    if (!request) {
      return context.json({ error: "folder must be an absolute path" }, 400);
    }
    const { binding, dataDir, hosts } = context.get("fate");
    try {
      const { url } = await openFolder({ binding, dataDir, hosts }, request);
      return context.json({ uraeda: binding.version(), url } satisfies OpenAnswer);
    } catch (error) {
      return context.json({ error: (error as Error).message.replace(/^refused: /, "") }, 400);
    }
  });
  return route;
}
