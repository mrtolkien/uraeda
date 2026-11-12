// A review's verdict, the review's one main action, in the Review pane beside the reader: the
// general comment, always there; a spec's risk tier and plan review; what an approval accepts of
// the decisions its branch changes; then Approve or Request changes, each pressed, each saying what
// it commits. Request changes needs a comment, and says so where the hand was. Once committed, the
// pane says so, and the agent's next run is one press away, never started by itself. By keys, in
// the pane `n` brings: `i` writes the general comment, and `a` and `r` ask first, in the shared
// confirmation, what they commit (rule 2).
import { type Signal, signal, untracked, View } from "nsh";
import { call, record } from "../../store";
import type { FileView, SpecItems } from "../../store/protocol";
import {
  Banner,
  Button,
  Confirm,
  Heading,
  Refusal,
  Segmented,
  Switch,
  Text,
} from "../../ui/controls";
import { registerKey } from "../../ui/keys";
import type { TextFieldRef } from "../../ui/text";
import type { FileArgs } from "../file/read";
import { shownOf } from "../file/read";
import { NextRun } from "../round/NextRun";
import { CommentField } from "./Comment";
import { pendingOf, reviewable } from "./Marks";

/** "the spec", "the plan". */
const theFile = (file: FileView) => (file.kind === "plan" ? "the plan" : "the spec");

/** What an approval of a spec accepts of the decisions its branch changes, in words. */
function decisionsWords(file: FileView): string | undefined {
  const changes = file.decisionChanges;
  if (changes.length === 0) return undefined;
  const named = changes.map((change) => {
    const verb = change.kind === "new" ? "adds" : change.kind === "removed" ? "removes" : "changes";
    return `${verb} ${change.title}`;
  });
  return `Approving accepts the decisions its branch changes: it ${named.join(", ")}. They apply once the feature is merged.`;
}

/** A spec's risk tier and plan review, as its approval may change them: what differs is sent. */
function Choices(props: {
  spec: SpecItems;
  tier: Signal<string>;
  planReview: Signal<boolean | undefined>;
}) {
  const reviewed = () =>
    props.planReview() ??
    props.spec.tiers.find((one) => one.value === props.tier())?.planReview ??
    false;
  return (
    <View style={{ gap: 8 }}>
      <If when={props.spec.tiers.length > 0}>
        <Segmented
          hint="The risk tier: how much review the rest of the feature gets."
          label="Risk tier"
          onChange={(value) => props.tier.set(value)}
          options={props.spec.tiers.map((one) => ({ label: one.value, value: one.value }))}
          value={props.tier()}
        />
      </If>
      <Switch
        label="The plan waits for your review"
        onChange={(on) => props.planReview.set(on)}
        value={reviewed()}
      />
    </View>
  );
}

export function Verdict(props: { args: FileArgs; file: () => FileView }) {
  const spec = () => shownOf(props.file()).items.spec;
  const tier = signal<string>(untracked(() => spec()?.riskTier ?? spec()?.tiers[0]?.value ?? ""));
  const planReview = signal<boolean | undefined>(undefined);
  const pending = signal<"approve" | "changes" | null>(null);
  const refusal = signal<string | null>(null);
  const feature = record("Feature", { id: props.args.folder, repo: props.args.repo });
  const comments = () => pendingOf(props.file()).length;
  const asking = signal<"approve" | "changes" | null>(null);
  let general: TextFieldRef | undefined;

  const send = async (approve: boolean) => {
    if (pending() !== null) return;
    if (!approve && comments() === 0) {
      refusal.set(
        "Add a comment first: on a part of the file, or the general one above, say what to change.",
      );
      return;
    }
    pending.set(approve ? "approve" : "changes");
    refusal.set(null);
    const where = { file: props.args.name, folder: props.args.folder, repo: props.args.repo };
    const subject = `${theFile(props.file())} of ${untracked(feature)?.title ?? props.args.folder}`;
    const write = {
      href: `/f/${props.args.folder}/${props.args.name}`,
      label: `${approve ? "Approving" : "Requesting changes to"} ${subject}`,
    };
    try {
      if (approve) {
        const shown = spec();
        await call("review.approve", {
          ...where,
          ...(props.file().kind === "spec" && shown !== null && tier() !== shown.riskTier
            ? { tier: tier() }
            : {}),
          ...(props.file().kind === "spec" && planReview() !== undefined
            ? { planReview: planReview() }
            : {}),
          write,
        });
      } else {
        await call("review.requestChanges", { ...where, write });
      }
    } catch (error) {
      refusal.set(`Not sent: ${(error as Error).message} Your comments are kept.`);
    }
    pending.set(null);
  };

  const subject = () => `${theFile(props.file())} of ${feature()?.title ?? props.args.folder}`;
  const withComments = () =>
    comments() === 0
      ? ""
      : ` with ${comments() === 1 ? "your comment" : `your ${comments()} comments`}`;
  const asked = () =>
    asking() === "approve"
      ? {
          icon: "badge-check" as const,
          label: "Approve",
          title: `Approve ${subject()}?`,
          words: [
            `Commits ${props.file().name}${withComments()} as approved.`,
            props.file().kind === "spec" ? decisionsWords(props.file()) : undefined,
          ]
            .filter((one) => one !== undefined)
            .join(" "),
        }
      : {
          icon: "pencil-line" as const,
          label: "Request changes",
          title: `Request changes to ${subject()}?`,
          words: `Commits ${props.file().name}${withComments()}: the agent revises ${theFile(props.file())} from them, once you start its next run.`,
        };
  registerKey([
    {
      hint: "i",
      hintLabel: "comment",
      keys: "i",
      label: "Write the general comment",
      run: () => general?.focus(),
    },
    {
      hint: "a",
      hintLabel: "approve",
      keys: "a",
      label: "Approve, after a confirmation",
      run: () => asking.set("approve"),
    },
    {
      hint: "r",
      hintLabel: "request changes",
      keys: "r",
      label: "Request changes, after a confirmation",
      // Without a comment there is nothing to confirm: the refusal says what to add.
      run: () => (comments() === 0 ? void send(false) : asking.set("changes")),
    },
  ]);

  return (
    <View style={{ gap: 12 }} testID="review-verdict-pane">
      <Heading level={2}>Your verdict</Heading>
      <Text tone="quiet">A general comment, for what is not about one part:</Text>
      <CommentField
        args={props.args}
        file={props.file()}
        label="A general comment"
        lines={null}
        ref={(field) => {
          general = field;
        }}
        testID="review-general"
      />
      <If when={props.file().kind === "spec" ? spec() : null}>
        {(shown) => <Choices planReview={planReview} spec={shown()} tier={tier} />}
      </If>
      <If when={props.file().kind === "spec" ? decisionsWords(props.file()) : undefined}>
        {(words) => <Text tone="caution">{words()}</Text>}
      </If>
      <If when={props.file().committed !== null}>
        <Banner title={`${props.file().name} changed since it was committed`} tone="caution">
          The verdict is on the committed version, the one you read: an agent may be writing it
          again.
        </Banner>
      </If>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Button
          breathes
          icon="badge-check"
          label="Approve"
          onPress={() => void send(true)}
          pending={pending() === "approve"}
          testID="review-approve"
          variant="main"
        />
        <Button
          icon="pencil-line"
          label="Request changes"
          onPress={() => void send(false)}
          pending={pending() === "changes"}
          testID="review-request"
        />
      </View>
      <If
        when={refusal()}
        else={
          <Text tone="quiet">
            {comments() === 0
              ? `Either commits ${props.file().name}. Request changes needs a comment.`
              : `Either commits ${props.file().name} with ${comments() === 1 ? "your comment" : `your ${comments()} comments`}: Approve leaves them to ${props.file().kind === "plan" ? "the implementation" : "the plan"}; Request changes revises ${theFile(props.file())} first.`}
          </Text>
        }
      >
        {(words) => <Refusal testID="review-refusal" words={words()} />}
      </If>
      <Confirm
        icon={asked().icon}
        keys={asking() === "changes" ? "r" : "a"}
        label={asked().label}
        onClose={() => asking.set(null)}
        onConfirm={() => void send(asking() === "approve")}
        open={asking() !== null}
        testID="review-confirm"
        title={asked().title}
        words={asked().words}
      />
    </View>
  );
}

/** The review once given: what it was, and the agent's next run, started only from here. */
export function Given(props: { args: FileArgs; file: () => FileView }) {
  const status = () => props.file().status;
  return (
    <If
      when={
        !reviewable(props.file()) && (status() === "approved" || status() === "changes-requested")
      }
    >
      <Banner
        action={<NextRun folder={props.args.folder} repo={props.args.repo} />}
        icon="circle-check"
        title={status() === "approved" ? "Approved" : "Changes requested"}
        tone={status() === "approved" ? "done" : "caution"}
      >
        <Text tone="quiet">
          The agent goes on once you start its next run, after reading its message.
        </Text>
      </Banner>
    </If>
  );
}
