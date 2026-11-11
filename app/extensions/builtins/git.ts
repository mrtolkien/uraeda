// Git, a built-in extension: its place, `g c` and `Space c` (`g g` is a list's first row, ruling
// R270), `/git`. Its screens are `app/screens/git/`: this declares them.
import { builtIn } from "./declare";

export const git = builtIn({
  name: "git",
  places: [
    { icon: "git-branch", id: "git", key: "c", pages: ["git"], title: "Git", to: { page: "git" } },
  ],
  title: "Git",
});
