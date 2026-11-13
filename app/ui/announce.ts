// What a screen reader hears beside what it reads: a toast as it shows, and a session's agent
// starting and ending, never the words it streams. NSH's `announce` speaks through the platform
// (GTK's `gtk_accessible_announce`, VoiceOver, TalkBack); the same words twice in a row are said
// once, as a draw may repeat them.
import { announce } from "nsh";

let last: { at: number; words: string } | null = null;

/** How long the same words are not said again, in ms. */
const AGAIN_MS = 1500;

/** Has the screen reader say `words`, unless it just did. */
export function say(words: string) {
  const now = Date.now();
  if (words === "" || (last?.words === words && now - last.at < AGAIN_MS)) return;
  last = { at: now, words };
  announce(words);
}
