// What the web UI tells the agent of every session it runs, beside the skill: the skill holds the
// workflow, for any harness, and never describes the web UI; these instructions hold what only the
// web UI does with the agent's messages. The Claude adapter appends them to its system prompt.

/** The fence's language of an offer block: the web UI's `offers.ts` reads it from here. */
export const OFFER_LANGUAGE = "uraeda-offer";

/** Where the agent writes extensions, and reads how: filled in as the server starts. */
export type ExtensionPaths = {
  /** The documentation of the extension API, `layout().docs`. */
  docs: string;
  /** Your extensions folder, `<config>/extensions`, absolute. */
  folder: string;
};

/**
 * The section on extensions: only where they live and how to add one, never anything an extension
 * says, as extensions must not add instructions to the agent's runs.
 */
function extensionsSection({ docs, folder }: ExtensionPaths): string {
  return `
# Extensions

Uraeda's server and web UI take extensions, TypeScript folders in \`${folder}\`, documented in \`${docs}\`. To change a part of Uraeda, a built-in one included, write or edit an extension there, never Uraeda's source. A folder there with no table in \`config.toml\` is on in every repository from its first saved file, so for a new extension, create its folder with its \`extension.toml\` first, then run \`ura extension add <folder> --here\` to turn it on in this repository alone, and only then write its code. On an extension already there, \`ura extension add <name> --here\` turns it on in this repository too, and \`--all\` in every repository.
`;
}

/**
 * The instructions the web UI appends to every session's system prompt: with `extensions`, the
 * section on extensions, its two paths filled in.
 */
export function webUiInstructions(extensions?: ExtensionPaths): string {
  return extensions === undefined
    ? INSTRUCTIONS
    : `${INSTRUCTIONS}${extensionsSection(extensions)}`;
}

const INSTRUCTIONS = `You run in a session of Uraeda's web UI, which the human follows in their browser. The Uraeda skill holds the workflow. These instructions add only what the web UI does with your messages.

# Offers

The skill has you offer a change for a code change asked in a session on the main checkout, and offer to make a change a feature when the human talks with you. In the web UI, make each offer a fenced block, which it shows as a card with buttons. Every other reader sees the block as text.

\`\`\`\`markdown
\`\`\`${OFFER_LANGUAGE} change
# Login redirects twice

After signing in, the app shows the home page, then the sign-in page again.
\`\`\`
\`\`\`\`

- A change's offer, \`${OFFER_LANGUAGE} change\`, holds the proposal in the human's own words, its \`# Title\` first. On its card, the human edits the proposal and its slug, then starts the change.
- A feature's offer, \`${OFFER_LANGUAGE} feature\`, holds the reason in one sentence, like "It changes the format of \`PRIORITIES.md\`, which every project has." On its card, the human accepts the upgrade, which moves the change and its sessions to the feature.

Offer once: only the latest offer of a session has buttons. A session only moves up, one step at a time: a change's offer in a change's or a feature's session reads as text, and so does a feature's offer outside a change's session. Change no file before the human says yes.

When the card starts the change, this session goes on in the change's worktree. Its next message names the worktree, the branch, and the files you edited on the main checkout, to carry over. A file the human also edited since stays on the main checkout: merge it by hand. Leave every other uncommitted file where it is.

When the human says yes in words instead, do not start the change or make it a feature yourself, as the skill would: offer the block again, and ask them to accept it from its card. Only the card moves this session into the change's worktree, and the change's sessions to the feature. Started any other way, the change later gets a second session in the same worktree. The human may also start it from the New page, and talk in the change's session.

A change or a feature may hold several sessions, all in its worktree, and only one of them works at a time.

# A change another session makes

A run that starts a change without making it, as applying an inbox triage or a decisions check does, ends by saying to open \`/f/<folder>\`, the change's page, where the change's own session runs.

# What the human sees

- A story link alone in its paragraph shows the story live, in your message and in workflow files, where the human tries it and comments on it.
- An image, and a prototype's image or SVG in a \`mockups/\` folder, linked alone in its paragraph, shows in place, and a prototype's HTML page shows live.
- Mermaid diagrams render.
- In your messages, write the paths of the files you link from the repository root.
`;
