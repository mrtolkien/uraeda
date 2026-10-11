import { Badge } from "@astryxdesign/core/Badge";
import { Banner } from "@astryxdesign/core/Banner";
import { BottomSheet } from "@astryxdesign/core/BottomSheet";
import { Button } from "@astryxdesign/core/Button";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Switch } from "@astryxdesign/core/Switch";
import { useMemo, useState } from "react";
import { useFateClient } from "react-fate";
import type { Block, CommentItem } from "uraeda-binding";
import { Blocks, selectable } from "./Blocks.tsx";
import type { useFile } from "./data.ts";
import { type Refusal, refusal } from "./errors.ts";
import { GrowingTextArea } from "./Question.tsx";
import { HookRefusal } from "./RoundPage.tsx";
import { Link } from "./routes.tsx";
import { FileView } from "./views.ts";

type File = NonNullable<ReturnType<typeof useFile>>;

/** Lines of the reviewed file, and the heading above them. */
type Range = { start: number; end: number; heading: string };

/** What the comment sheet holds: a new comment on lines or on the whole file, or an edit. */
type Sheet =
  | { kind: "lines"; text: string }
  | { kind: "general"; text: string }
  | { kind: "edit"; number: number; text: string };

function where(comment: CommentItem) {
  if (comment.general) {
    return `C${comment.number} · general`;
  }
  return comment.startLine === comment.endLine
    ? `C${comment.number} · line ${comment.startLine}`
    : `C${comment.number} · lines ${comment.startLine}–${comment.endLine}`;
}

function anchor(range: Range) {
  const lines =
    range.start === range.end ? `Line ${range.start}` : `Lines ${range.start}–${range.end}`;
  return `${lines}, under "${range.heading}"`;
}

/**
 * A spec, a plan, or an assessment to review, as committed at its branch's tip: tapping blocks
 * selects lines to comment on, pending comments show under their blocks, and the end of the page
 * holds the verdict.
 */
export function ReviewPage({ file }: { file: File }) {
  const fate = useFateClient();
  const version = file.committed ?? file.current;
  const document = version.document;
  const isSpec = file.kind === "spec";
  const spec = version.items.spec;
  const tasks = version.items.plan?.tasks ?? [];
  const review = file.review?.review;
  const comments = review?.verdict === "pending" ? review.comments : [];
  const [selection, setSelection] = useState<Range>();
  const [sheet, setSheet] = useState<Sheet>();
  const [summary, setSummary] = useState("");
  const [tier, setTier] = useState(spec?.riskTier ?? "low");
  const [planReview, setPlanReview] = useState<boolean>();
  const [error, setError] = useState<Refusal>();
  const [message, setMessage] = useState<string>();

  // Each comment shows under the smallest tappable block holding its last line.
  const placed = useMemo(() => {
    const map = new Map<number, Array<CommentItem>>();
    for (const comment of comments.filter((c) => !c.general)) {
      const holder = document.blocks
        .filter(
          (b) => selectable(b) && b.startLine <= comment.endLine && comment.endLine <= b.endLine,
        )
        .sort((a, b) => a.endLine - a.startLine - (b.endLine - b.startLine))[0];
      if (holder) {
        map.set(holder.id, [...(map.get(holder.id) ?? []), comment]);
      }
    }
    return map;
  }, [comments, document]);

  const stories = new Map(spec?.stories.map((story) => [story.headingBlock, story]) ?? []);
  const taskHeadings = new Map(tasks.map((task) => [task.headingBlock, task]));

  const run = async (call: () => Promise<{ error?: unknown }>) => {
    setError(undefined);
    setMessage(undefined);
    const result = await call();
    if (result.error) {
      const failed = refusal(result.error);
      if (failed.kind === "hook") {
        setError(failed);
      } else {
        setMessage(failed.message);
      }
      return false;
    }
    return true;
  };

  const tap = (block: Block) => {
    const next = selection
      ? {
          start: Math.min(selection.start, block.startLine),
          end: Math.max(selection.end, block.endLine),
          heading: block.startLine < selection.start ? (block.heading ?? "") : selection.heading,
        }
      : { start: block.startLine, end: block.endLine, heading: block.heading ?? "" };
    setSelection(next);
    if (!sheet) {
      setSheet({ kind: "lines", text: "" });
    }
  };

  const close = () => {
    setSheet(undefined);
    setSelection(undefined);
  };

  const send = async () => {
    if (!sheet) {
      return;
    }
    const input = { folder: file.folder, file: file.name };
    const done =
      sheet.kind === "edit"
        ? await run(() =>
            fate.mutations.review.edit({
              input: { ...input, number: sheet.number, text: sheet.text },
              view: FileView,
            }),
          )
        : await run(() =>
            fate.mutations.review.comment({
              input: {
                ...input,
                text: sheet.text,
                ...(sheet.kind === "lines" && selection
                  ? { startLine: selection.start, endLine: selection.end }
                  : {}),
              },
              view: FileView,
            }),
          );
    if (done) {
      close();
    }
  };

  const verdict = async (approve: boolean) => {
    const input = { folder: file.folder, file: file.name, summary: summary || undefined };
    await run(() =>
      approve
        ? fate.mutations.review.approve({
            input: {
              ...input,
              ...(isSpec && tier !== spec?.riskTier ? { tier } : {}),
              ...(isSpec && planReview !== undefined ? { planReview } : {}),
            },
            view: FileView,
          })
        : fate.mutations.review.requestChanges({ input, view: FileView }),
    );
  };

  const pendingNote = (comment: CommentItem) => (
    <div key={comment.number} className="pending">
      <div className="meta">
        <span>{where(comment)}</span>
        <span>
          <Button
            variant="ghost"
            size="sm"
            label="Edit"
            onClick={(event: React.MouseEvent) => {
              event.stopPropagation();
              setSheet({ kind: "edit", number: comment.number, text: comment.text });
            }}
          />
          <Button
            variant="ghost"
            size="sm"
            label="Remove"
            onClick={(event: React.MouseEvent) => {
              event.stopPropagation();
              void run(() =>
                fate.mutations.review.remove({
                  input: { folder: file.folder, file: file.name, number: comment.number },
                  view: FileView,
                }),
              );
            }}
          />
        </span>
      </div>
      {comment.text}
    </div>
  );

  const plannedReview =
    planReview ??
    (tier !== spec?.riskTier ? tier === "high" : (spec?.planReview ?? tier === "high"));

  return (
    <div className="page">
      <p className="small muted">
        <Link to={`/f/${file.folder}`}>{file.folder}</Link> ›{" "}
        <span className="mono">{file.name}</span>
      </p>
      {file.reviewStale && comments.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <Banner
            status="warning"
            title={`The ${file.kind} changed since your comments: your ${comments.length} pending ${
              comments.length === 1 ? "comment is" : "comments are"
            } on the previous version. Adding a comment replaces it.`}
            endContent={
              <Button
                label="Start over"
                clickAction={async () => {
                  await run(() =>
                    fate.mutations.review.startOver({
                      input: { folder: file.folder, file: file.name },
                      view: FileView,
                    }),
                  );
                }}
              />
            }
          />
        </div>
      )}
      <p className="small muted">
        Tap a block to comment on it. Showing the version committed at{" "}
        <span className="mono">{file.tip}</span>
        {file.committed && ", which differs from the file on disk"}.
      </p>
      <Blocks
        document={document}
        selection={{
          isSelected: (block) =>
            selection !== undefined &&
            block.startLine >= selection.start &&
            block.endLine <= selection.end,
          onTap: tap,
          after: (block) => placed.get(block.id)?.map(pendingNote),
        }}
        override={(block) => {
          const story = stories.get(block.id);
          if (story) {
            return (
              <div key={block.id} id={block.anchor}>
                <div className="band" />
                <div className="label">
                  {story.id} · {story.priority}
                </div>
                <h3 className="title-l">{story.title}</h3>
              </div>
            );
          }
          const task = taskHeadings.get(block.id);
          if (task) {
            return (
              <div key={block.id} id={block.anchor} className="row">
                <span className="grow">
                  <strong>
                    Task {task.number}: {task.title}
                  </strong>
                </span>
                <Badge
                  variant={task.done === task.total ? "success" : "neutral"}
                  label={`${task.done}/${task.total}`}
                />
              </div>
            );
          }
          return undefined;
        }}
      />
      <div className="band" />
      <div className="label">Your review</div>
      {comments.length === 0 && <p className="muted small">No comment yet.</p>}
      {comments.map((comment) =>
        // A general comment has no block to show under: it is edited and removed here.
        comment.general ? (
          pendingNote(comment)
        ) : (
          <div key={comment.number} className="row">
            <span className="grow">
              <span className="small muted">{where(comment)}</span>
              <div>{comment.text}</div>
            </span>
          </div>
        ),
      )}
      <div className="actions">
        <Button
          label="Add a general comment"
          onClick={() => setSheet({ kind: "general", text: "" })}
        />
      </div>
      <GrowingTextArea
        label="Summary"
        value={summary}
        onChange={setSummary}
        placeholder="Optional"
      />
      {isSpec && (
        <>
          <div className="field-label">Risk tier</div>
          <SegmentedControl
            label="Risk tier"
            value={tier}
            onChange={(value: string) => setTier(value)}
          >
            <SegmentedControlItem value="low" label="low" />
            <SegmentedControlItem value="medium" label="medium" />
            <SegmentedControlItem value="high" label="high" />
          </SegmentedControl>
          <div style={{ marginTop: 12 }}>
            <Switch
              label="The plan waits for your review"
              value={plannedReview}
              onChange={(checked: boolean) => setPlanReview(checked)}
            />
          </div>
        </>
      )}
      {error && (
        <HookRefusal
          error={error}
          what="Your review is saved, not committed."
          onRetry={async () => {
            await run(() =>
              fate.mutations.commit.retry({
                input: { folder: file.folder, file: file.name },
                view: FileView,
              }),
            );
          }}
        />
      )}
      {message && <p className="not-saved">{message}</p>}
      {file.committed && (
        <p className="not-saved">
          {file.name} has changes not committed: the review is of the committed version. Commit or
          discard them first.
        </p>
      )}
      <div className="actions">
        <Button
          variant="destructive"
          label="Request changes"
          isDisabled={comments.length === 0 || file.committed != null}
          tooltip={comments.length === 0 ? "Add a comment first" : undefined}
          clickAction={() => verdict(false)}
        />
        <Button
          variant="primary"
          label="Approve"
          isDisabled={file.committed != null}
          clickAction={() => verdict(true)}
        />
      </div>
      {comments.length === 0 && <p className="small muted">Request changes: Add a comment first</p>}
      <BottomSheet
        label="Comment"
        isOpen={sheet !== undefined}
        onOpenChange={(open: boolean) => !open && close()}
        hasScrim={false}
      >
        {sheet && (
          <div>
            <p className="small muted">
              {sheet.kind === "lines" && selection
                ? anchor(selection)
                : sheet.kind === "edit"
                  ? `Editing C${sheet.number}`
                  : "General"}
            </p>
            <GrowingTextArea
              label="Comment text"
              value={sheet.text}
              onChange={(text) => setSheet({ ...sheet, text })}
            />
            <div className="actions">
              <Button label="Cancel" onClick={close} />
              <Button
                variant="primary"
                label={sheet.kind === "edit" ? "Save comment" : "Add comment"}
                isDisabled={!sheet.text.trim()}
                clickAction={send}
              />
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
