// Which paths are the server's own: `vp dev` sends them to the server, and the session check
// closes them, so the two never disagree.

/**
 * The paths the server answers, a repository's and the global ones, the handoff, `/open`, and
 * signing in and out, `/session` and `/sessions`; the built UI, or Vite, serves everything else. A
 * repository's images, uploads, and Storybooks are only under its prefix.
 */
export const SERVER_PATHS =
  /^\/(open|sessions?|(r\/[^/?]+\/)?(fate|raw|mockups)|r\/[^/?]+\/(attach|images|chat-images|inbox\/note-image|preview))(\/|\?|$)/;
