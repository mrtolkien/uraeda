// The open choices of the design language, `specs/ui/design-language.md`, each one token, at the
// value the build takes (ruling R13). To change one, change its value here, and nowhere else.

export const choices = {
  /** A running pane's line. */
  "light.running.motion": "steady" as "steady" | "breathe" | "off",
  /** The backdrop's wash of the theme's two accents. */
  "backdrop.wash": true,
  /** The gap between panes on a wide window, in points. */
  "pane.gap": 8,
  /** Whether the editing mode colours the focused field and the status line's ends. */
  "light.mode": true,
  /** Whether a view's one main action breathes. */
  "button.main.motion": "breathe" as "breathe" | "steady",
  /** Whether the caret leaves a trail when it jumps. */
  "caret.trail": true,
  /** Where a pane's title sits. */
  "pane.title": "wrap" as "wrap" | "tab" | "border",
  /** How deep heights look: fills alone, fills and lips, or soft shadows too. */
  "height.depth": "lips" as "lips" | "soft" | "tone",
  /** A key's look. */
  "key.look": "chip" as "chip" | "glow" | "cap",
  /** The main button's look. */
  "button.main.look": "lamp" as "lamp" | "glow" | "tube",
};

export type Choices = typeof choices;
