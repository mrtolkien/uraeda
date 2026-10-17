// The data view of a feature's branch changes: the files its branch changed, read for the
// "Changes" list.
import { dataView } from "@nkzw/fate/server";
import type { BranchChanges, ChangedFile } from "uraeda-binding";

/** A file changed on a feature's branch, its lines null for a binary file. */
export type ChangedFileRecord = Omit<ChangedFile, "added" | "removed"> & {
  added: number | null;
  removed: number | null;
};
/**
 * A feature's branch changes, by its folder: null when it has no branch, is merged, or the default
 * branch is unknown, and when they `failed` to be read.
 */
export type BranchChangesRecord = {
  changes: (Omit<BranchChanges, "files"> & { files: Array<ChangedFileRecord> }) | null;
  failed: boolean;
  id: string;
};

/**
 * Branch changes as they are sent: a binary file's lines sent as null, for the client's cache
 * keeps a field an answer leaves out.
 */
export function sentChanges(changes: BranchChanges | null): BranchChangesRecord["changes"] {
  return (
    changes && {
      ...changes,
      files: changes.files.map((file) => ({
        ...file,
        added: file.added ?? null,
        removed: file.removed ?? null,
      })),
    }
  );
}

export const branchChangesDataView = dataView<BranchChangesRecord>("BranchChanges")({
  changes: true,
  failed: true,
  id: true,
});
