// The data views of the repository list and the add form's folder suggestions, read from every
// endpoint, the global one included.
import { dataView } from "@nkzw/fate/server";

/** A listed repository, as the menu shows it. */
export type RepositoryRow = {
  /** `path` with the home folder written `~`. */
  home: string;
  /** Its folder no longer holds a git repository. */
  missing: boolean;
  /** Its name in the list, the `<name>` of its `/r/<name>/` URLs. */
  name: string;
  /** Its main checkout, absolute. */
  path: string;
};

/**
 * The listed repositories, most recently opened first: one record, `repositories`, kept live, read
 * from every endpoint.
 */
export type RepositoriesRecord = {
  /**
   * The repository `repositories.add` added or found listed, in that mutation's answer only: null
   * in every other answer.
   */
  added: string | null;
  id: string;
  /** Why `repositories.json` could not be read at its last change: the rows are the last read. */
  problem: string | null;
  rows: Array<RepositoryRow>;
};

/** A folder the add form suggests, `path` as typed and ending with `/`. */
export type FolderSuggestionRecord = { git: boolean; path: string };

/** The folders the add form suggests for a typed text, which is its ID: not live. */
export type FolderSuggestionsRecord = { id: string; rows: Array<FolderSuggestionRecord> };

export const repositoriesDataView = dataView<RepositoriesRecord>("Repositories")({
  added: true,
  id: true,
  problem: true,
  rows: true,
});

export const folderSuggestionsDataView = dataView<FolderSuggestionsRecord>("FolderSuggestions")({
  id: true,
  rows: true,
});

/** The id of the one record of the list. */
export const REPOSITORIES_ID = "repositories";
