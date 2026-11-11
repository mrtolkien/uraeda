// The decisions, a built-in extension: its place (`g d`, `Space d`, `/decisions`, in the phone's
// `…`), with a decision, the check, the constitution, and a branch's decision. Its screens are
// `app/screens/decisions/`: this declares them.
import { builtIn } from "./declare";

export const decisions = builtIn({
  name: "decisions",
  pages: ["branch-decision"],
  places: [
    {
      icon: "scale",
      id: "decisions",
      key: "d",
      onPhone: "more",
      pages: ["decisions", "decision", "decisions-check", "constitution"],
      title: "Decisions",
      to: { page: "decisions" },
    },
  ],
  title: "Decisions",
});
