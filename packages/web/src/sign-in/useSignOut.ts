// Signing out, from the settings' Sign-in category: this browser, or every device.
import { useState } from "react";
import { useServerFetch } from "../attach/ServerFetch.tsx";
import { type ConfirmOptions, useConfirm } from "../fields/Confirm.tsx";
import { markSignedOut } from "./signedOut.ts";

/** The answer to a sign-out that never reached the server. */
const UNREACHABLE = "Could not reach the Uraeda server.";

/**
 * Signs this browser out, `DELETE /session`, or every device, `DELETE /sessions`: once the server
 * answers, the sign-in screen shows. Each resolves with the error to show, if the server could not
 * sign out, the sign-in screen staying away.
 */
export function useSignOut() {
  const fetch = useServerFetch();
  const end = async (path: "/session" | "/sessions"): Promise<string | undefined> => {
    let response: Response;
    try {
      response = await fetch(path, { method: "DELETE" });
    } catch {
      return UNREACHABLE;
    }
    // A 401: already signed out, as the server sees it.
    if (!response.ok && response.status !== 401) {
      return (await response.text().catch(() => "")) || `HTTP ${response.status}`;
    }
    markSignedOut();
    return undefined;
  };
  return { signOut: () => end("/session"), signOutEverywhere: () => end("/sessions") };
}

/** What "Sign out everywhere…" asks first: it cannot be undone. */
const SIGN_OUT_EVERYWHERE: ConfirmOptions = {
  body: "Every browser signed in to Uraeda, this one included, will need the access key again.",
  cancel: "Cancel",
  confirm: "Sign out everywhere",
  destructive: true,
  title: "Sign out every device?",
};

/**
 * "Sign out everywhere…": `ask` asks first, then signs every device out. If the server could not,
 * `failed` says why, until the next ask.
 */
export function useSignOutEverywhere() {
  const confirm = useConfirm();
  const { signOutEverywhere } = useSignOut();
  const [failed, setFailed] = useState<string>();
  const ask = async () => {
    setFailed(undefined);
    if (!(await confirm(SIGN_OUT_EVERYWHERE))) {
      return;
    }
    const error = await signOutEverywhere();
    if (error) {
      setFailed(error);
    }
  };
  return { ask: () => void ask(), failed };
}
