// A round's file, read, with each state before it in words: reading, refused, or no such round.
import { type JSX } from "nsh";
import { record } from "../../store";
import type { FileView } from "../../store/protocol";
import { Banner, Spinner } from "../../ui/controls";
import { Empty } from "../../ui/lists";
import type { RoundArgs } from "./saves";

/** The round's file, read live. */
export const roundFileOf = (args: RoundArgs) =>
  record("WorkflowFile", { id: args.id, repo: args.repo });

export function WithRound(props: {
  args: RoundArgs;
  children: (file: () => FileView) => JSX.Element;
}) {
  const file = roundFileOf(props.args);
  return (
    <If
      when={file.error()}
      else={
        <If when={file() !== undefined} else={<Spinner label="Reading the round" />}>
          <If
            when={file()}
            else={
              <Empty
                icon="message-circle-question"
                title="No such round"
                words={`${props.args.id} is not in the repository: it was renamed, dismissed, or merged.`}
              />
            }
          >
            {(shown) => props.children(shown)}
          </If>
        </If>
      }
    >
      {(error) => (
        <Banner title="The round could not be read" tone="danger">
          {error().message}
        </Banner>
      )}
    </If>
  );
}
