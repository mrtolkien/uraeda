import { BottomSheet } from "@astryxdesign/core/BottomSheet";
import { Button } from "@astryxdesign/core/Button";
import { useRef, useState } from "react";
import { useFateClient } from "react-fate";
import type { EntryItem } from "uraeda-binding";
import { usePriorities } from "./data.ts";
import { refusal } from "./errors.ts";
import { GrowingTextArea } from "./Question.tsx";
import { plain, Spans } from "./Spans.tsx";
import { PrioritiesView } from "./views.ts";

const TITLES: Record<string, string> = {
  now: "Now",
  next: "Next",
  later: "Later",
  blocked: "Blocked",
};

type Spot = { section: string; index: number };

/**
 * Where a line dropped above another goes, as the core counts it: among the lines once the
 * dragged one is taken out, so a line moved down its own section lands one place earlier.
 */
export function dropIndex(from: Spot, target: Spot) {
  return from.section === target.section && from.index < target.index
    ? target.index - 1
    : target.index;
}

/**
 * Every line of `PRIORITIES.md`, by section: dragged by its handle, or moved, edited, and deleted
 * from its menu, each change written at once; a bar commits or discards them.
 */
export function PrioritiesPage() {
  const fate = useFateClient();
  const priorities = usePriorities();
  const [menu, setMenu] = useState<{ entry: EntryItem; section: string; index: number }>();
  const [editing, setEditing] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [confirm, setConfirm] = useState(false);
  const dragged = useRef<{ id: string; y: number; from: Spot }>(undefined);
  if (!priorities) {
    return null;
  }
  const hash = priorities.hash;

  const run = async (call: () => Promise<{ error?: unknown }>) => {
    setMessage(undefined);
    const result = await call();
    if (result.error) {
      const failed = refusal(result.error);
      setMessage(failed.message);
      if (failed.kind === "conflict") {
        void fate.request(
          { priorities: { id: "priorities", view: PrioritiesView } },
          { mode: "network-only" },
        );
      }
      return false;
    }
    return true;
  };
  const move = (entry: string, section: string, index: number) =>
    run(() =>
      fate.mutations.priorities.move({
        input: { entry, section, index, hash },
        view: PrioritiesView,
      }),
    );

  /** Drops a dragged line where the pointer is released: before the row under it. */
  const drop = (clientY: number) => {
    const from = dragged.current;
    dragged.current = undefined;
    if (!from || Math.abs(clientY - from.y) < 8) {
      return;
    }
    const rows = [...document.querySelectorAll<HTMLElement>("[data-entry]")];
    const target = rows.find((row) => {
      const box = row.getBoundingClientRect();
      return clientY < box.top + box.height / 2;
    });
    if (target) {
      const spot = { section: target.dataset.section!, index: Number(target.dataset.index) };
      void move(from.id, spot.section, dropIndex(from.from, spot));
    } else {
      const last = rows.at(-1);
      void move(from.id, last?.dataset.section ?? "later", Number.MAX_SAFE_INTEGER);
    }
  };

  const changes = priorities.changes;
  return (
    <div className="page">
      <h1 className="title-l">Priorities</h1>
      {priorities.sections.map((section) => (
        <div key={section.section}>
          <div className="group label">{section.title}</div>
          {section.entries.length === 0 && <p className="small muted">Nothing yet.</p>}
          {section.entries.map((entry, index) => (
            <div
              key={entry.id}
              className="row"
              data-entry={entry.id}
              data-section={section.section}
              data-index={index}
            >
              <span
                className="handle"
                aria-hidden="true"
                onPointerDown={(event) => {
                  dragged.current = {
                    id: entry.id,
                    y: event.clientY,
                    from: { section: section.section, index },
                  };
                  event.currentTarget.setPointerCapture?.(event.pointerId);
                }}
                onPointerUp={(event) => drop(event.clientY)}
              >
                ≡
              </span>
              <span className="grow">
                <Spans spans={entry.spans} />
                {entry.nestedSpans.map((spans, line) => (
                  <div key={line} className="sub">
                    <Spans spans={spans} />
                  </div>
                ))}
              </span>
              <Button
                variant="ghost"
                label={`Actions for ${plain(entry.spans)}`}
                isIconOnly
                icon={<span aria-hidden="true">⋯</span>}
                onClick={() => setMenu({ entry, section: section.section, index })}
              />
            </div>
          ))}
        </div>
      ))}
      {message && <p className="not-saved">{message}</p>}
      {changes > 0 && (
        <div className="commit-bar">
          <span className="grow">
            {changes} {changes === 1 ? "change" : "changes"} to commit
          </span>
          {confirm ? (
            <>
              <Button label="Keep them" onClick={() => setConfirm(false)} />
              <Button
                variant="destructive"
                label="Discard them"
                clickAction={async () => {
                  setConfirm(false);
                  await run(() =>
                    fate.mutations.priorities.discard({ input: {}, view: PrioritiesView }),
                  );
                }}
              />
            </>
          ) : (
            <>
              <Button variant="ghost" label="Discard" onClick={() => setConfirm(true)} />
              <Button
                variant="primary"
                label="Commit"
                clickAction={async () => {
                  await run(() =>
                    fate.mutations.priorities.commit({ input: {}, view: PrioritiesView }),
                  );
                }}
              />
            </>
          )}
        </div>
      )}
      <BottomSheet
        label="Line actions"
        isOpen={menu !== undefined}
        onOpenChange={(open: boolean) => {
          if (!open) {
            setMenu(undefined);
            setEditing(undefined);
          }
        }}
      >
        {menu && (
          <div>
            <p className="small">
              <Spans spans={menu.entry.spans} />
            </p>
            {editing !== undefined ? (
              <>
                <GrowingTextArea label="Line" value={editing} onChange={setEditing} />
                <div className="actions">
                  <Button label="Cancel" onClick={() => setEditing(undefined)} />
                  <Button
                    variant="primary"
                    label="Save line"
                    isDisabled={!editing.trim()}
                    clickAction={async () => {
                      if (
                        await run(() =>
                          fate.mutations.priorities.edit({
                            input: { entry: menu.entry.id, text: editing, hash },
                            view: PrioritiesView,
                          }),
                        )
                      ) {
                        setEditing(undefined);
                        setMenu(undefined);
                      }
                    }}
                  />
                </div>
              </>
            ) : (
              <div className="actions" style={{ flexDirection: "column" }}>
                {menu.index > 0 && (
                  <Button
                    label="Move up"
                    clickAction={async () => {
                      setMenu(undefined);
                      await move(menu.entry.id, menu.section, menu.index - 1);
                    }}
                  />
                )}
                <Button
                  label="Move down"
                  clickAction={async () => {
                    setMenu(undefined);
                    await move(menu.entry.id, menu.section, menu.index + 1);
                  }}
                />
                {Object.entries(TITLES)
                  .filter(([id]) => id !== menu.section)
                  .map(([id, title]) => (
                    <Button
                      key={id}
                      label={`Move to ${title}`}
                      clickAction={async () => {
                        setMenu(undefined);
                        await move(menu.entry.id, id, Number.MAX_SAFE_INTEGER);
                      }}
                    />
                  ))}
                <Button label="Edit" onClick={() => setEditing(menu.entry.text)} />
                <Button
                  variant="destructive"
                  label="Delete"
                  clickAction={async () => {
                    setMenu(undefined);
                    await run(() =>
                      fate.mutations.priorities.remove({
                        input: { entry: menu.entry.id, hash },
                        view: PrioritiesView,
                      }),
                    );
                  }}
                />
              </div>
            )}
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
