// A spec's or a plan's review, beside it: the verdict while it waits (`app/screens/review/`), then
// the review not sent yet, the review its revision answers, and every
// part changed since that review, one row each. `Enter` or a press on a changed part brings it to
// the reader's top; a removed part says its words, which the reader no longer holds.
import { View } from "nsh";
import type { FileView, ReviewItems, SinceChange } from "../../store/protocol";
import { Banner, Heading, type IconName } from "../../ui/controls";
import { focusPane, PaneScroll, usePane } from "../../ui/layout";
import { Card, createCursor, Empty, Line, List } from "../../ui/lists";
import { readerPane } from "./panes";
import { jumpTo } from "./place";
import { type FileArgs, shownOf, WithFile } from "./read";
import { reviewable } from "../review/Marks";
import { Given, Verdict } from "../review/Verdict";
import { plural } from "../../ui/words";

/** A review's verdict, in words. */
const VERDICTS: Readonly<Record<string, string>> = {
  approved: "Approved",
  "changes-requested": "Asks for changes",
  pending: "No verdict yet",
};

/** A review as a card: its verdict, its summary, and each comment where it points. */
function ReviewCard(props: { review: ReviewItems; title: string; who: string }) {
  return (
    <Card
      facts={props.review.comments.map((comment) => ({
        icon: "message-square",
        label: `${comment.general ? "On the whole" : (comment.heading ?? "On its title")}: ${comment.text}`,
      }))}
      icon="badge-check"
      state={{
        label: VERDICTS[props.review.verdict] ?? props.review.verdict,
        tone: props.review.verdict === "changes-requested" ? "caution" : "quiet",
      }}
      title={props.title}
      who={props.review.summary ?? props.who}
    />
  );
}

const SINCE_ICONS: Readonly<Record<string, IconName>> = {
  added: "plus",
  changed: "pencil-line",
  removed: "minus",
};

/** A part's words, as one line. */
const words = (part: SinceChange) => part.runs.map((run) => run.text).join(" ");

/** The parts changed since the review a revision answers, each a row. */
function Since(props: { args: FileArgs; file: () => FileView }) {
  const kept = usePane().remember<string | null>("at", null);
  const parts = () => props.file().sinceReview?.parts ?? [];
  const rows = () => parts().map((_, index) => ({ id: String(index) }));
  const cursor = createCursor(rows, {
    initial: kept() ?? undefined,
    onChange: (id) => kept.set(id ?? null),
  });
  const open = (id: string) => {
    const after = parts()[Number(id)]?.after;
    if (after === null || after === undefined) return;
    const block = shownOf(props.file()).document.blocks.find(
      (one) => one.parent === null && one.endLine >= after.start,
    );
    if (block === undefined) return;
    jumpTo(props.args, block.id);
    focusPane(readerPane(props.args));
  };
  return (
    <List
      cursor={cursor}
      onOpen={open}
      openLabel="read the part"
      row={(id) => {
        const part = () => parts()[Number(id())];
        return (
          <Line
            icon={SINCE_ICONS[part()?.kind ?? ""] ?? "pencil-line"}
            label={
              part()?.kind === "removed"
                ? `${part()?.heading ?? ""}: ${part() === undefined ? "" : words(part()!)}`
                : (part()?.heading ?? "")
            }
            meta={part()?.kind}
            metaTone={part()?.kind === "removed" ? "danger" : "caution"}
            quiet={part()?.kind === "removed"}
          />
        );
      }}
    />
  );
}

function Parts(props: { args: FileArgs; file: () => FileView }) {
  const pending = () => props.file().review?.review ?? null;
  const since = () => props.file().sinceReview;
  const what = () => (props.file().kind === "plan" ? "plan" : "spec");
  return (
    <View style={{ gap: 16 }}>
      <If when={reviewable(props.file())}>
        <Verdict args={props.args} file={props.file} />
      </If>
      <Given args={props.args} file={props.file} />
      <If when={pending()}>
        {(review) => (
          <ReviewCard
            review={review()}
            title={review().verdict === "pending" ? "Your review, not sent" : "Your review"}
            who={
              review().verdict === "pending"
                ? `${plural(review().comments.length, "comment")}, sent with your verdict`
                : `${plural(review().comments.length, "comment")}, sent with it`
            }
          />
        )}
      </If>
      <If when={props.file().answered}>
        {(review) => (
          <ReviewCard
            review={review()}
            title="The review this revision answers"
            who="Its comments are answered in the spec's part “Your review”."
          />
        )}
      </If>
      <If when={since()}>
        {(shown) => (
          <View style={{ gap: 8 }}>
            <Heading level={3}>{`Since your review of revision ${shown().revision}`}</Heading>
            <If
              when={shown().found}
              else={
                <Banner title="The reviewed version is gone" tone="caution">
                  Its commit is no longer in the repository: what changed since cannot be told.
                </Banner>
              }
            >
              <If
                when={shown().parts.length > 0}
                else={<Empty icon="circle-check" title="Nothing changed since" />}
              >
                <Since args={props.args} file={props.file} />
              </If>
            </If>
          </View>
        )}
      </If>
      <If
        when={
          !reviewable(props.file()) &&
          pending() === null &&
          props.file().answered === null &&
          since() === null
        }
      >
        <Empty
          icon="badge-check"
          title="No review yet"
          words={
            props.file().status === "awaiting-human"
              ? `The ${what()} waits for your first review.`
              : `The ${what()} has not been sent for review: its agent is writing it.`
          }
        />
      </If>
    </View>
  );
}

/** The pane "Review" of a spec. */
export function SpecReview(props: { args: FileArgs }) {
  return (
    <PaneScroll style={{ flex: 1 }}>
      <WithFile args={props.args} beside>
        {(file) => <Parts args={props.args} file={file} />}
      </WithFile>
    </PaneScroll>
  );
}
