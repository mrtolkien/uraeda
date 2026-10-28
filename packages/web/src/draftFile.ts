/** The path the editor and the moves take for a draft the workspace lists: a folder's proposal. */
export function draftFile(path: string) {
  return path.endsWith(".md") ? path : `${path}/proposal.md`;
}
