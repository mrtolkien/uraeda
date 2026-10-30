// The data view of a feature's branch changes: the files its branch changed, read for the
// "Changes" list.
import { dataView } from "@nkzw/fate/server";
import type { BranchChanges, ChangedFile } from "uraeda-binding";
import type { Binding } from "./context.ts";

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

/** The id of the one record of every feature's branch changes. */
export const ALL_BRANCH_CHANGES_ID = "all-branch-changes";

/** A feature's count of changed files and of lines added and removed, as a card shows them. */
export type FeatureChangesRecord = Omit<BranchChanges, "files"> & { folder: string };

/**
 * Every feature's branch changes, without their files, read in one request for the sidebar's
 * cards: a feature without any is left out. `failed` when they could not be read.
 */
export type AllBranchChangesRecord = {
  failed: boolean;
  features: Array<FeatureChangesRecord>;
  id: string;
};

/**
 * Every feature's branch changes in `repo`. A repository without `specs/` has none; one whose
 * changes cannot be read is answered as failed, and logged with the error's first line.
 */
export async function allBranchChanges(
  binding: Pick<Binding, "allBranchChanges">,
  repo: string,
): Promise<AllBranchChangesRecord> {
  const id = ALL_BRANCH_CHANGES_ID;
  try {
    const features = (await binding.allBranchChanges(repo)).map(
      ({ changes: { added, count, removed }, folder }) => ({ added, count, folder, removed }),
    );
    return { failed: false, features, id };
  } catch (error) {
    const [line] = (error instanceof Error ? error.message : String(error)).split("\n");
    if (/^(refused: )?no specs\/ folder /.test(line ?? "")) {
      return { failed: false, features: [], id };
    }
    process.stderr.write(`uraeda-server: the branches' changes could not be read: ${line}\n`);
    return { failed: true, features: [], id };
  }
}

export const allBranchChangesDataView = dataView<AllBranchChangesRecord>("AllBranchChanges")({
  failed: true,
  features: true,
  id: true,
});
