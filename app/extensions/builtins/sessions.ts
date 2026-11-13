// The Sessions place: no extension, always on, declared as the built-ins' places are so that it
// keeps its place among them (`g s`, `Space s`, `/sessions`). Its screens are
// `app/screens/session/`.
import { builtIn } from "./declare";

export const sessions = builtIn({
  always: true,
  name: "sessions",
  places: [
    {
      icon: "message-square",
      id: "sessions",
      key: "s",
      pages: ["sessions", "session-id"],
      title: "Sessions",
      to: { page: "sessions" },
    },
  ],
  title: "Sessions",
});
