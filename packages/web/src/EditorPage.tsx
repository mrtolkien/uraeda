import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useEffect, useState } from "react";
import { useFateClient } from "react-fate";
import { Blocks } from "./Blocks.tsx";
import { useDraft } from "./data.ts";
import { refusal } from "./errors.ts";
import { navigate } from "./routes.tsx";
import { useSave } from "./useSave.ts";
import { DraftView, FeatureView } from "./views.ts";

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

/**
 * A draft or a proposal, edited as text: saved as typed over the version it was read at, shown
 * rendered on demand, committed, and, for a draft, started as a feature.
 */
export function EditorPage({ path }: { path: string }) {
  const fate = useFateClient();
  const draft = useDraft(path);
  const [text, setText] = useState(draft?.text ?? "");
  const [preview, setPreview] = useState(false);
  const [conflict, setConflict] = useState<string>();
  const [message, setMessage] = useState<string>();
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
  const { settle } = save;
  useEffect(() => {
    if (draft) {
      settle(draft.hash);
    }
  }, [draft, settle]);
  if (!draft) {
    return (
      <div className="page">
        <p>No draft {path}.</p>
      </div>
    );
  }
  const isDraft = path.startsWith("specs/drafts/") || path.startsWith("specs/backlog/");
  const changes = draft.priorityChanges;
  const takesPriorities =
    isDraft && changes > 0
      ? `Your ${changes} priority ${changes === 1 ? "change is" : "changes are"} committed with it.`
      : undefined;

  const commit = async () => {
    setMessage(undefined);
    await save.flush();
    const result = await fate.mutations.text.commit({ input: { path }, view: DraftView });
    setMessage(result.error ? refusal(result.error).message : "Committed.");
  };
  const start = async () => {
    setMessage(undefined);
    await save.flush();
    const result = await fate.mutations.feature.start({
      input: { draft: path, slug },
      view: FeatureView,
    });
    if (result.error) {
      setMessage(refusal(result.error).message);
    } else if (typeof result.result?.folder === "string") {
      navigate(`/f/${result.result.folder}`);
    }
  };
  const reload = () => {
    setConflict(undefined);
    void fate
      .request({ draft: { id: path, view: DraftView } }, { mode: "network-only" })
      .then(() => setText(draft.text));
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
              <Button label="Load the new version" onClick={reload} />
            </div>
          </Banner>
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
      <div className="actions">
        <Button label={preview ? "Edit" : "Preview"} onClick={() => setPreview(!preview)} />
        <Button variant={isDraft ? "secondary" : "primary"} label="Commit" clickAction={commit} />
      </div>
      {isDraft && (
        <>
          <div className="band" />
          <TextInput label="Slug" value={slug} onChange={(value: string) => setSlug(value)} />
          <div className="actions">
            <Button variant="primary" label="Start the feature" clickAction={start} />
          </div>
          <p className="small muted">Creates its branch and worktree, and moves the line to Now.</p>
        </>
      )}
      {message && <p className={message === "Committed." ? "saved" : "not-saved"}>{message}</p>}
    </div>
  );
}
