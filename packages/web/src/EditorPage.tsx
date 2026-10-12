import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useEffect, useRef, useState } from "react";
import { useFateClient } from "react-fate";
import { Blocks } from "./Blocks.tsx";
import { CommitActions } from "./CommitActions.tsx";
import { useDraft } from "./data.ts";
import { discoveryOf, LEVELS, withDiscovery, type Level } from "./discovery.ts";
import { refusal } from "./errors.ts";
import { navigate, useRestoreScroll } from "./routes.tsx";
import { startRun } from "./runs.ts";
import { useSave } from "./useSave.ts";
import { DraftView, FeatureView } from "./views.ts";

const LEVEL_LABELS: Record<Level, string> = { low: "Low", medium: "Medium", high: "High" };

const SECTIONS: Record<string, string> = {
  now: "Now",
  next: "Next",
  later: "Later",
  blocked: "Blocked",
};

/** The slug a draft's file name gives: `specs/drafts/git-listener.md` is `git-listener`. */
function slugOf(path: string) {
  const name = path.split("/").filter(Boolean).at(-1) ?? "";
  return name === "proposal.md" ? (path.split("/").at(-2) ?? "") : name.replace(/\.md$/, "");
}

/** The feature or bug folder of a proposal's or a report's path, `specs/[bugs/]<folder>/...`. */
function folderOf(path: string) {
  return /^specs\/(?:bugs\/)?(\d{4}-\d{2}-\d{2}-[^/]+)\//.exec(path)?.[1];
}

/**
 * A draft or a proposal, edited as text: saved as typed over the version it was read at, shown
 * rendered on demand, committed, and, for a draft, started as a feature.
 */
export function EditorPage({ path }: { path: string }) {
  const fate = useFateClient();
  const draft = useDraft(path);
  // Its data is read before it draws: the position comes back at once.
  useRestoreScroll(true);
  const [text, setText] = useState(draft?.text ?? "");
  const [preview, setPreview] = useState(false);
  const [conflict, setConflict] = useState<string>();
  const [message, setMessage] = useState<{ text: string; ok: boolean }>();
  const [slug, setSlug] = useState(slugOf(path));
  const save = useSave<string>(async (value, previous) => {
    const result = await fate.mutations.text.save({
      input: { path, text: value, hash: previous },
      view: DraftView,
    });
    if (result.error) {
      const failed = refusal(result.error);
      if (failed.kind === "conflict") {
        setConflict(failed.message);
      }
      return { ok: false, message: failed.message };
    }
    return { ok: true, saved: result.result?.hash ?? previous };
  }, draft?.hash ?? "");
  const { settle, idle } = save;
  const shown = useRef(text);
  shown.current = text;
  // A text changed elsewhere replaces this one when nothing of it waits to be saved.
  useEffect(() => {
    if (!draft) {
      return;
    }
    if (idle() && draft.text !== shown.current) {
      setText(draft.text);
    }
    settle(draft.hash);
  }, [draft, idle, settle]);

  if (!draft) {
    return (
      <div className="page">
        <p>No draft {path}.</p>
      </div>
    );
  }
  const isDraft = path.startsWith("specs/drafts/") || path.startsWith("specs/backlog/");
  const isProposal = !path.endsWith("/report.md");
  const changes = draft.priorityChanges;
  const takesPriorities =
    isDraft && changes > 0
      ? `Your ${changes} priority ${changes === 1 ? "change is" : "changes are"} committed with it.`
      : undefined;

  const commit = async (continues: boolean) => {
    setMessage(undefined);
    if (!(await save.flush())) {
      setMessage({ text: "Your text is not saved: nothing was committed.", ok: false });
      return;
    }
    const result = await fate.mutations.text.commit({ input: { path }, view: DraftView });
    if (result.error) {
      setMessage({ text: refusal(result.error).message, ok: false });
      return;
    }
    const folder = folderOf(path);
    if (continues && folder) {
      const started = await startRun(fate, {
        folder,
        trigger: "proposal",
        file: path.split("/").at(-1),
      });
      setMessage({ text: started.message, ok: started.ok });
    } else {
      setMessage({ text: "Committed.", ok: true });
    }
  };
  const start = async (continues: boolean) => {
    setMessage(undefined);
    if (!(await save.flush())) {
      setMessage({ text: "Your text is not saved: the feature was not started.", ok: false });
      return;
    }
    const result = await fate.mutations.feature.start({
      input: { draft: path, slug },
      view: FeatureView,
    });
    if (result.error) {
      setMessage({ text: refusal(result.error).message, ok: false });
    } else if (typeof result.result?.folder === "string") {
      const folder = result.result.folder;
      // A refused run leaves "Start the agent" on the feature's page.
      if (continues) {
        await startRun(fate, { folder, trigger: "start" });
      }
      navigate(`/f/${folder}`);
    }
  };
  /** Reads the file again, and puts its text in place of the one that was not saved. */
  const reload = async () => {
    setConflict(undefined);
    const { draft: ref } = await fate.request(
      { draft: { id: path, view: DraftView } },
      { mode: "network-only" },
    );
    if (ref) {
      // fate does not infer the view's type through `readView`: these are its fields.
      const fresh = (await fate.readView(DraftView, ref)) as unknown as {
        data: { text: string; hash: string };
      };
      setText(fresh.data.text);
      settle(fresh.data.hash);
    }
  };

  return (
    <div className="page">
      <div className="bar" style={{ margin: "-16px -16px 16px" }}>
        <span className="title mono">{path.replace(/^specs\//, "")}</span>
        <span className="small muted" style={{ paddingRight: 12 }}>
          {save.state.kind === "saving"
            ? "saving…"
            : save.state.kind === "saved"
              ? "saved ✓"
              : draft.committed
                ? "committed"
                : "not committed"}
        </span>
      </div>
      <h1 className="title-l">{draft.title}</h1>
      {draft.entry && (
        <p className="small muted">
          {draft.committed ? "Committed" : "Not committed"} · Priorities,{" "}
          {SECTIONS[draft.entry.section] ?? draft.entry.section}
        </p>
      )}
      {conflict && (
        <div style={{ marginBottom: 14 }}>
          <Banner status="error" title={conflict} collapsible={false}>
            <div className="actions" style={{ flexDirection: "column" }}>
              <Button
                label="Copy my text"
                onClick={() => void navigator.clipboard?.writeText(text)}
              />
              <Button label="Load the new version" clickAction={reload} />
            </div>
          </Banner>
        </div>
      )}
      {isProposal && (
        <div style={{ marginBottom: 12 }}>
          <SegmentedControl
            label="Discovery effort"
            value={discoveryOf(text)}
            onChange={(value: string) => {
              const next = withDiscovery(text, value as Level);
              setText(next);
              save.schedule(next);
            }}
          >
            {LEVELS.map((level) => (
              <SegmentedControlItem key={level} value={level} label={LEVEL_LABELS[level]} />
            ))}
          </SegmentedControl>
          <p className="small muted">
            How far the agent researches before asking: low reads the code and its docs, medium also
            compares a few alternatives online, high looks far and wide.
          </p>
        </div>
      )}
      {preview ? (
        <Blocks document={draft.document} />
      ) : (
        <TextArea
          label="Text"
          isLabelHidden
          value={text}
          rows={Math.max(16, text.split("\n").length + 2)}
          onChange={(value: string) => {
            setText(value);
            save.schedule(value);
          }}
        />
      )}
      {save.state.kind === "error" && !conflict && (
        <p className="not-saved">Not saved: {save.state.message}</p>
      )}
      {takesPriorities && <p className="small muted">{takesPriorities}</p>}
      {isDraft ? (
        <div className="actions">
          <Button label={preview ? "Edit" : "Preview"} onClick={() => setPreview(!preview)} />
          <Button variant="secondary" label="Commit" clickAction={() => commit(false)} />
        </div>
      ) : (
        <CommitActions label="Commit" onCommit={commit}>
          <Button label={preview ? "Edit" : "Preview"} onClick={() => setPreview(!preview)} />
        </CommitActions>
      )}
      {isDraft && (
        <>
          <div className="band" />
          <TextInput label="Slug" value={slug} onChange={(value: string) => setSlug(value)} />
          <CommitActions
            label="Start the feature"
            continueLabel="Start and continue"
            onlyLabel="Start only"
            onCommit={start}
          />
          <p className="small muted">Creates its branch and worktree, and moves the line to Now.</p>
        </>
      )}
      {message && <p className={message.ok ? "saved" : "not-saved"}>{message.text}</p>}
    </div>
  );
}
