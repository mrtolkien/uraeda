import { useAnnounce } from "@astryxdesign/core/hooks";
import { useCallback, useState } from "react";
import type { AttachedView } from "uraeda-binding";
import type { ChatImage } from "uraeda-server/fate";
import { refusal } from "../errors.ts";
import { useServerFetch } from "./ServerFetch.tsx";

/** What an upload gave: the core's image, or its refusal. */
export type AttachResult =
  | { ok: true; value: AttachedView | ChatImage }
  | { ok: false; message: string };

/** The last upload's status, shown under its field: adding, added, or the refusal. */
export type AttachStatus = { text: string; error: boolean };

const MIB = 1024 * 1024;
/** The core's limit, 20 MB counted in MiB. */
const LIMIT = 20 * MIB;
/** The name in texts of an image without one, as the core names it. */
const PASTED = "pasted image";

/** A size in MB, rounded up to one decimal, as the core writes it in its refusals. */
function megabytes(bytes: number) {
  const tenths = Math.ceil((bytes * 10) / MIB);
  return tenths % 10 === 0 ? String(tenths / 10) : (tenths / 10).toFixed(1);
}

/** The name a file is told by: a pasted image has none. */
const nameOf = (file: File) => file.name || PASTED;

/**
 * Uploads images one after the other to `POST /attach`, for a workflow file at `path` or for a
 * chat, and returns their results in order. Each is announced, "Adding <name>…", then "Added
 * <name>" or the core's refusal, and the last status shows under the field. A file over the core's
 * limit is refused before it is uploaded: a slow upload over it may end in a network error first.
 */
export function useAttach(target: { path: string } | { chat: true }) {
  const fetch = useServerFetch();
  const announce = useAnnounce();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<AttachStatus>();
  const path = "path" in target ? target.path : undefined;

  const show = useCallback(
    (text: string, error = false) => {
      setStatus({ text, error });
      announce(text, error ? "assertive" : "polite");
    },
    [announce],
  );

  const upload = useCallback(
    async (file: File, path: string | undefined): Promise<AttachResult> => {
      const name = nameOf(file);
      if (file.size > LIMIT) {
        return {
          ok: false,
          message: `This image is over 20 MB: ${name} is ${megabytes(file.size)} MB.`,
        };
      }
      const query = new URLSearchParams(path === undefined ? { chat: "1" } : { path });
      if (file.name) {
        query.set("name", file.name);
      }
      const body = new FormData();
      body.append("file", file);
      let text: string;
      try {
        text = await (await fetch(`/attach?${query}`, { method: "POST", body })).text();
      } catch {
        return { ok: false, message: "Could not reach the Uraeda server." };
      }
      let answer: AttachedView | ChatImage | { error: string };
      try {
        answer = JSON.parse(text);
      } catch {
        // Not the route's answer, like the guard's refusal of another site.
        return { ok: false, message: text };
      }
      return "error" in answer
        ? { ok: false, message: refusal(answer.error).message }
        : { ok: true, value: answer };
    },
    [fetch],
  );

  const attach = useCallback(
    async (files: File[]) => {
      setBusy(true);
      const results: AttachResult[] = [];
      // A draft that became a folder with the first image takes the next ones at its new path.
      let at = path;
      try {
        for (const file of files) {
          show(`Adding ${nameOf(file)}…`);
          const result = await upload(file, at);
          results.push(result);
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
        setStatus({ text: refused.message, error: true });
      }
      return results;
    },
    [path, show, upload],
  );

  return { attach, busy, status };
}
