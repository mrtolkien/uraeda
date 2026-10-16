// The settings page's categories, in the order the page lists them: the real ones first, then the
// ones whose settings come with later features, each named with the feature that brings it; and
// the search across them, which finds the settings to come too.

export type CategoryId = "server" | "appearance" | "sign-in" | "agents" | "runs" | "reviews";

/** A setting a later feature brings: what it sets, and that feature. */
export type PlannedSetting = { feature: string; label: string };

export type Category = {
  id: CategoryId;
  label: string;
  /** The settings to come, for a category no feature has built yet. */
  planned?: ReadonlyArray<PlannedSetting>;
  /** The labels of the settings the category shows today, as the search finds them. */
  settings: ReadonlyArray<string>;
  /** The line under the category's name in the list. */
  summary: string;
};

export const CATEGORIES: ReadonlyArray<Category> = [
  {
    id: "server",
    label: "Server",
    settings: ["Allowed host names", "Port", "Open a browser at start"],
    summary: "Host names, port, and start",
  },
  { id: "appearance", label: "Appearance", settings: ["Theme"], summary: "Theme, on this browser" },
  {
    id: "sign-in",
    label: "Sign-in",
    settings: ["Sign out", "Sign out everywhere"],
    summary: "Sign out, here or everywhere",
  },
  {
    id: "agents",
    label: "Agents",
    planned: [
      { feature: "the Codex runtime", label: "The agent that runs each step" },
      { feature: "the Codex runtime", label: "The model and effort of each step" },
    ],
    settings: [],
    summary: "Coming later",
  },
  {
    id: "runs",
    label: "Runs",
    planned: [
      {
        feature: "run options",
        label: "One session for the whole feature, or a new session at each step",
      },
      { feature: "run options", label: "Sub-agents during the implementation" },
      { feature: "run options", label: "A different choice for one feature" },
    ],
    settings: ["Build in a fresh session"],
    summary: "Build in a fresh session, more later",
  },
  {
    id: "reviews",
    label: "Reviews",
    planned: [
      { feature: "review settings", label: "The review's command, model, and number of reviewers" },
      { feature: "the adversarial review", label: "A second review by another model" },
    ],
    settings: [],
    summary: "Coming later",
  },
];

/** The category a path names, or undefined for an unknown one. */
export function categoryOf(id: string): Category | undefined {
  return CATEGORIES.find((category) => category.id === id);
}

/** A setting the search found: its label, and the category that shows it. */
export type Found = { category: Category; label: string };

/**
 * The settings whose label, or whose category's, holds `text`, trimmed and in any case, the
 * settings to come included, in the page's order; none for an empty text.
 */
export function searchSettings(text: string): Array<Found> {
  const needle = text.trim().toLowerCase();
  if (needle === "") {
    return [];
  }
  return CATEGORIES.flatMap((category) => {
    const named = category.label.toLowerCase().includes(needle);
    const labels = [...category.settings, ...(category.planned ?? []).map(({ label }) => label)];
    return labels
      .filter((label) => named || label.toLowerCase().includes(needle))
      .map((label) => ({ category, label }));
  });
}
