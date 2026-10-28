/**
 * The path the editor and the moves take for a proposal file the workspace lists: a folder's
 * `proposal.md`.
 */
export function proposalFile(path: string) {
  return path.endsWith(".md") ? path : `${path}/proposal.md`;
}
