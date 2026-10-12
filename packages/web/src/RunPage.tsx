import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Divider } from "@astryxdesign/core/Divider";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { type RefObject, useEffect, useRef, useState } from "react";
import { useFateClient } from "react-fate";
import { Denials, RunReason, RunStatus } from "./AgentPanel.tsx";
import { Crumbs } from "./Crumbs.tsx";
import { useFeature, useRun } from "./data.ts";
import { stepLabel } from "./labels.ts";
import { Page } from "./layout/Page.tsx";
import { useWidthClass } from "./layout/useWidthClass.ts";
import { currentEntry, updateEntry, useRestoreScroll } from "./routes.tsx";
import { RunLog, type OpenGroups } from "./RunLog.tsx";
import { RunView } from "./views.ts";

/** How close to its end, in pixels, the log still counts as read to the end. */
const AT_END = 24;

/** The element that scrolls an element: the nearest that scrolls on its own, or the window. */
function scroller(element: HTMLElement): HTMLElement | undefined {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const overflow = getComputedStyle(node).overflowY;
    if (overflow === "auto" || overflow === "scroll") {
      return node;
    }
  }
  return undefined;
}

/**
 * Keeps the end of an element in view as it grows, while `enabled` and while the human is at the
 * end: scrolled up, nothing moves. It scrolls the element's pane on wide screens, the window on
 * narrow ones.
 */
function useFollowEnd(ref: RefObject<HTMLElement | null>, enabled: boolean) {
  useEffect(() => {
    const element = ref.current;
    if (!enabled || !element || typeof ResizeObserver === "undefined") {
      return;
    }
    const box = scroller(element);
    const atEnd = () =>
      box
        ? box.scrollHeight - box.scrollTop - box.clientHeight <= AT_END
        : document.documentElement.scrollHeight - window.scrollY - window.innerHeight <= AT_END;
    // Growing does not scroll: the last position read, at the end or not, holds until the human
    // scrolls.
    let following = atEnd();
    const onScroll = () => {
      following = atEnd();
    };
    const target = box ?? window;
    target.addEventListener("scroll", onScroll, { passive: true });
    const observer = new ResizeObserver(() => {
      if (following) {
        if (box) {
          box.scrollTo(0, box.scrollHeight);
        } else {
          window.scrollTo(0, document.documentElement.scrollHeight);
        }
      }
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      target.removeEventListener("scroll", onScroll);
    };
  }, [ref, enabled]);
}

/** The groups of tool calls opened in the log, kept in the history entry for Back and reloads. */
function useOpenGroups(): OpenGroups {
  const [open, setOpen] = useState<ReadonlyArray<number>>(() => currentEntry().open ?? []);
  // The entry this view was opened on: still shown while the next page loads, it must not write
  // into the next one's entry.
  const [id] = useState(() => currentEntry().id);
  return {
    open,
    onOpenChange: (seq, isOpen) => {
      const next = isOpen ? [...open.filter((s) => s !== seq), seq] : open.filter((s) => s !== seq);
      setOpen(next);
      if (currentEntry().id === id) {
        updateEntry({ open: next });
      }
    },
  };
}

/** A run of a feature, by its ID: no run when the feature does not list it. */
export function RunPage({ folder, id }: { folder: string; id: string }) {
  const feature = useFeature(folder);
  // Its data is read before it draws: the position comes back at once.
  useRestoreScroll(true);
  if (!feature || feature.missing) {
    return (
      <Page>
        <Banner
          status="error"
          title={`No feature ${folder}.`}
          collapsible={false}
          description={
            <Link href="/" hasUnderline>
              Open home
            </Link>
          }
        />
      </Page>
    );
  }
  if (!feature.runs.includes(id)) {
    return (
      <Page>
        <Banner
          status="error"
          title={`No run ${id} in ${folder}.`}
          collapsible={false}
          description={
            <Link href={`/f/${folder}`} hasUnderline>
              Open the feature
            </Link>
          }
        />
      </Page>
    );
  }
  return (
    <Run
      folder={folder}
      id={id}
      isLatest={feature.runs[0] === id}
      waitsOnHuman={feature.step.waitsOn === "human"}
    />
  );
}

/**
 * A run: its step, its state, why it failed and what auto mode blocked, Stop while it goes on, and
 * its log, followed while the human reads its end.
 */
function Run({
  folder,
  id,
  isLatest,
  waitsOnHuman,
}: {
  folder: string;
  id: string;
  isLatest: boolean;
  waitsOnHuman: boolean;
}) {
  const fate = useFateClient();
  const run = useRun(id);
  const wide = useWidthClass() === "wide";
  const groups = useOpenGroups();
  const log = useRef<HTMLDivElement>(null);
  const running = run?.state === "running";
  useFollowEnd(log, running);
  if (!run) {
    return null;
  }
  const stop = async () => {
    // The run ends once its process exits: its live update brings the state.
    await fate.mutations.run.stop({ input: { run: run.id }, view: RunView });
  };
  return (
    <Page>
      {!wide && <Crumbs folder={folder} current="Run" />}
      <VStack gap={3}>
        {/* Beside the feature page, whose title is the page's heading. */}
        <Heading level={wide ? 2 : 1}>{stepLabel(run.step)}</Heading>
        <Text type="supporting" color="secondary">
          {new Date(run.startedAt).toLocaleString()}
        </Text>
        <RunStatus run={run} waitsOnHuman={isLatest && waitsOnHuman} />
        {run.reason && !running && <RunReason reason={run.reason} />}
        {!running && <Denials denials={run.denials} />}
        {running && (
          <HStack gap={2}>
            <Button variant="destructive" label="Stop" clickAction={stop} />
          </HStack>
        )}
        <Divider />
        <div ref={log}>
          <RunLog run={run} groups={groups} />
        </div>
      </VStack>
    </Page>
  );
}
