import { useAnnounce } from "@astryxdesign/core/hooks";
import { useCallback, useRef, useState } from "react";
import type { AttachedView } from "uraeda-binding";
import type { ChatImage } from "uraeda-server/fate";
import { IMAGE_LIMIT, overLimit } from "uraeda-server/limits";
import { refusal } from "../errors.ts";
import { useServerFetch } from "./ServerFetch.tsx";

/** What an upload gave: the core's image, or its refusal. */
export type AttachResult =
  | { ok: true; value: AttachedView | ChatImage }
  | { ok: false; message: string };

/** The last upload's status, shown under its field: adding, added, or the refusal. */
export type AttachStatus = { text: string; error: boolean };

/** The name in texts of an image without one, as the core names it. */
const PASTED = "pasted image";

/**
 * How long an upload may take, the core's encoding included: a 20 MB photo over a slow phone
 * connection takes most of it. An upload the server never answers ends then, and what waits for
 * it, like Submit, goes on (R72).
 */
const UPLOAD_TIMEOUT = 120_000;

/** The refusal of an upload the server did not answer in time. */
const TIMED_OUT = "The image could not be added: the server did not answer in time.";

/** The name a file is told by: a pasted image has none. */
const nameOf = (file: File) => file.name || PASTED;

/**
 * Uploads images one after the other to `POST /attach`, for a workflow file at `path` or for a
 * chat, and returns their results in order. Each is announced, "Adding <name>…", then "Added
 * <name>" or the core's refusal, and the last status shows under the field. A file over the core's
 * limit is refused before it is uploaded: a slow upload over it may end in a network error first.
 * `initial` is the status to show first, as a moved draft's page shows the one its old page left.
 */
export function useAttach(target: { path: string } | { chat: true }, initial?: AttachStatus) {
  const fetch = useServerFetch();
  const announce = useAnnounce();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<AttachStatus | undefined>(initial);
  // The status last set, which a caller reads before React draws it.
  const last = useRef(initial);
  const path = "path" in target ? target.path : undefined;

  const show = useCallback(
    (text: string, error = false) => {
      last.current = { text, error };
      setStatus(last.current);
      announce(text, error ? "assertive" : "polite");
    },
    [announce],
  );

  const upload = useCallback(
    async (file: File, path: string | undefined): Promise<AttachResult> => {
      const name = nameOf(file);
      if (file.size > IMAGE_LIMIT) {
        return { ok: false, message: overLimit(name, file.size) };
      }
      const query = new URLSearchParams(path === undefined ? { chat: "1" } : { path });
      if (file.name) {
        query.set("name", file.name);
      }
      const body = new FormData();
      body.append("file", file);
      let response: Response;
      let text: string;
      try {
        response = await fetch(`/attach?${query}`, {
          method: "POST",
          body,
          signal: AbortSignal.timeout(UPLOAD_TIMEOUT),
        });
        text = await response.text();
      } catch (error) {
        return {
          ok: false,
          message:
            error instanceof DOMException && error.name === "TimeoutError"
              ? TIMED_OUT
              : "Could not reach the Uraeda server.",
        };
      }
      // Not the route's answer: the guard's refusal, like "Forbidden site", is plain text, worth
      // showing; a proxy's error page is not.
      const unknown = {
        ok: false,
        message: `The image could not be added (HTTP ${response.status}).`,
      } as const;
      const type = response.headers.get("content-type") ?? "";
      if (!type.startsWith("application/json")) {
        return type.startsWith("text/plain") && text.trim()
          ? { ok: false, message: text }
          : unknown;
      }
      let answer: AttachedView | ChatImage | { error: string };
      try {
        answer = JSON.parse(text);
      } catch {
        return unknown;
      }
      return "error" in answer
        ? { ok: false, message: refusal(answer.error).message }
        : { ok: true, value: answer };
    },
    [fetch],
  );

  /**
   * Uploads files in order, to the file at `at`, the target's path by default. A draft that became
   * a folder with the first image takes the next ones at its new path. `onResult` hears each
   * result as it comes, as the chat's thumbnails show each image once saved.
   */
  const attach = useCallback(
    async (files: File[], at = path, onResult?: (result: AttachResult, index: number) => void) => {
      setBusy(true);
      const results: AttachResult[] = [];
      try {
        for (const file of files) {
          show(`Adding ${nameOf(file)}…`);
          const result = await upload(file, at);
          results.push(result);
          onResult?.(result, results.length - 1);
          if (result.ok && "moved" in result.value && result.value.moved) {
            at = result.value.moved;
          }
          if (!result.ok) {
            show(result.message, true);
          } else if ("path" in result.value) {
            show(`Added ${result.value.path.split("/").at(-1)}`);
          } else {
            show(`Added ${nameOf(file)}`);
          }
        }
      } finally {
        setBusy(false);
      }
      // A refusal stays shown, over the images added after it.
      const refused = results.findLast((result) => !result.ok);
      if (refused && !refused.ok) {
        last.current = { text: refused.message, error: true };
        setStatus(last.current);
      }
      return results;
    },
    [path, show, upload],
  );

  /** The status last set, drawn or not yet. */
  const lastStatus = useCallback(() => last.current, []);

  return { attach, busy, status, show, lastStatus };
}
