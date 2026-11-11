// What every pane of a workflow file shares: its arguments, the record, the version the page shows,
// what its status means, and the states before the file is there, each in words.
import { type JSX } from "nsh";
import { navigate, record } from "../../store";
import type { Block, FileView, Span, VersionView } from "../../store/protocol";
import { Banner, Spinner } from "../../ui/controls";
import type { Tone } from "../../ui/tokens";
import { Empty } from "../../ui/lists";

/** A pane of a file's page: the repository, the feature's folder, and the file's name. */
export type FileArgs = { folder: string; name: string; repo: string };

/** The record's id of a file: `<folder>/<name>`. */
export const fileId = (args: FileArgs) => `${args.folder}/${args.name}`;

/** The file, read live: `undefined` until it came, `null` when the folder has no such file. */
export const fileOf = (args: FileArgs) =>
  record("WorkflowFile", { id: fileId(args), repo: args.repo });

/**
 * The version the page shows: while a file waits for the human, the one committed at its branch's
 * tip, which is the one reviewed; otherwise the one on disk, which an agent may be writing.
 */
export const shownOf = (file: FileView): VersionView =>
  file.status === "awaiting-human" ? (file.committed ?? file.current) : file.current;

/** A status, in words and a tone: what a frontmatter's `status:` means to the human. */
const STATUSES: Readonly<Record<string, { label: string; tone: Tone }>> = {
  answered: { label: "Answered", tone: "done" },
  approved: { label: "Approved", tone: "done" },
  "auto-approved": { label: "Approved without a review", tone: "done" },
  "awaiting-human": { label: "Waits for your review", tone: "needs" },
  "changes-requested": { label: "Changes requested", tone: "caution" },
  draft: { label: "Being written", tone: "live" },
};

export function statusOf(file: FileView): { label: string; tone: Tone } | undefined {
  if (file.status === null) return undefined;
  const known = STATUSES[file.status];
  if (file.kind === "clarifications" && file.status === "awaiting-human") {
    return { label: "Waits for your answers", tone: "needs" };
  }
  return known ?? { label: file.status, tone: "quiet" };
}

/** A file's kind, as a person names it. */
const KINDS: Readonly<Record<string, string>> = {
  clarifications: "Round of questions",
  "data-model": "Data model",
  discovery: "Discovery",
  findings: "Findings",
  plan: "Plan",
  proposal: "Proposal",
  record: "Record",
  rulings: "Rulings",
  spec: "Spec",
};

export const kindWord = (file: FileView) => KINDS[file.kind] ?? file.name;

/** A span's words, without their marks: a heading's text as a row says it. */
export const plain = (spans: ReadonlyArray<Span>) => spans.map((span) => span.text).join("");

/** The document's title, its first `#` heading: what the page's head and its tab say. */
export const titleOf = (blocks: ReadonlyArray<Block>) =>
  blocks.find((block) => block.kind === "heading" && block.level === 1);

/**
 * Draws `children` with the file once it is read; until then, why not: reading, refused, or no
 * such file, with the way to its feature.
 */
export function WithFile(props: {
  args: FileArgs;
  children: (file: () => FileView) => JSX.Element;
  /** Beside the reader, which says why at length: a line, with no way out of its own. */
  beside?: boolean;
}) {
  const file = fileOf(props.args);
  return (
    <If
      when={file.error()}
      else={
        <If when={file() !== undefined} else={<Spinner label={`Reading ${props.args.name}`} />}>
          <If
            when={file()}
            else={
              <If
                when={props.beside !== true}
                else={<Empty icon="file-text" title={`No file ${props.args.name}`} />}
              >
                <Empty
                  action={{
                    icon: "flag",
                    label: "Open the feature",
                    run: () => navigate({ folder: props.args.folder, page: "feature" }),
                  }}
                  icon="file-text"
                  title={`No file ${props.args.name} in ${props.args.folder}`}
                  words="Its branch and its worktree hold no such file: it was renamed, removed by the finish, or the address was typed by hand."
                />
              </If>
            }
          >
            {(shown) => props.children(shown)}
          </If>
        </If>
      }
    >
      {(error) => (
        <Banner title={`${props.args.name} could not be read`} tone="danger">
          {error().message}
        </Banner>
      )}
    </If>
  );
}
