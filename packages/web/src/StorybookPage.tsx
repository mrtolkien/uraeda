// Uraeda's Storybook page: Storybook's own interface for a checkout, its list of stories, its
// canvas, and its controls, in one frame sandboxed without `allow-same-origin`, as tall as the
// window under the crumbs. The page is a view of the checkout's Storybook, which it asks for again
// every 5 minutes, so a Storybook left open is not stopped.
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { borderVars, colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import type { StoryTarget } from "uraeda-binding";
import { Crumbs } from "./Crumbs.tsx";
import { MAIN_CHECKOUT, usePreview, usePreviewOn, useStory } from "./data.ts";
import { Page } from "./layout/Page.tsx";
import { Paragraph } from "./layout/Paragraph.tsx";
import { redirect, useRepoPath, useRestoreScroll, useSearch } from "./routes.tsx";
import { storybookHref } from "./stories.tsx";
import { NoSuchStory, State, TryAgain } from "./StoryEmbed.tsx";

const styles = stylex.create({
  frame: {
    backgroundColor: colorVars["--color-background-surface"],
    borderBlockStartColor: colorVars["--color-border"],
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: borderVars["--border-width"],
    borderWidth: 0,
    boxSizing: "border-box",
    display: "block",
    flexGrow: 1,
    minHeight: 0,
    width: "100%",
  },
  // The crumbs, whose own margin is the space under them.
  crumbs: {
    paddingBlockStart: spacingVars["--spacing-3"],
    paddingInline: spacingVars["--spacing-4"],
  },
  // The page's own controls, under why Storybook does not show.
  controls: {
    paddingInline: spacingVars["--spacing-4"],
  },
  // The window's height under what is above the page, like the phone's top bar.
  height: (height: string) => ({ height }),
  page: {
    display: "flex",
    flexDirection: "column",
  },
});

const SANDBOX = "allow-scripts allow-popups";

/** The story an inline link names, `?story=<path>#<export>`, or undefined. */
function storyOf(search: string): StoryTarget | undefined {
  const story = new URLSearchParams(search).get("story");
  const at = story?.lastIndexOf("#") ?? -1;
  if (!story || at < 0) {
    return undefined;
  }
  return { export: story.slice(at + 1), path: story.slice(0, at) };
}

/** Storybook's own address of a story, `?path=/story/<id>`, from the page's, or "". */
function pathOf(search: string): string {
  const path = new URLSearchParams(search).get("path");
  return path ? `?path=${path.split("/").map(encodeURIComponent).join("/")}` : "";
}

/**
 * The page's box: from where it starts, under the phone's top bar, to the window's bottom, so the
 * frame inside it takes the height the crumbs leave.
 */
function useWindowHeight(shown: boolean) {
  const box = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState<number>();
  useLayoutEffect(() => {
    const measure = () => {
      const element = box.current;
      if (element) {
        setTop(element.getBoundingClientRect().top + window.scrollY);
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [shown]);
  const height = top === undefined ? undefined : `calc(var(--size-viewport-height) - ${top}px)`;
  return { box, height };
}

/** Storybook's interface, once its process is ready, at the story the page's `?path=` names. */
function StorybookFrame({ folder }: { folder: string }) {
  const record = usePreview(folder);
  const search = useSearch();
  if (record?.state === "ready" && record.base) {
    return (
      <iframe
        sandbox={SANDBOX}
        src={`${record.base}${pathOf(search)}`}
        title="Storybook"
        {...stylex.props(styles.frame)}
      />
    );
  }
  if (record?.state === "failed") {
    return <Failed folder={folder}>{record.error}</Failed>;
  }
  return <Waiting starting={record?.state !== "none"} />;
}

/** A Storybook that failed, with Try again. */
function Failed({ children, folder }: { children: ReactNode; folder: string }) {
  return (
    <>
      <State error>{children}</State>
      <HStack gap={2} xstyle={styles.controls}>
        <TryAgain folder={folder} />
      </HStack>
    </>
  );
}

/** A Storybook starting, or none for a feature without a worktree. */
function Waiting({ starting }: { starting: boolean }) {
  return (
    <State>
      {starting
        ? "Starting Storybook for this branch…"
        : "This feature has no worktree, so its stories cannot run here."}
    </State>
  );
}

/**
 * An inline link's story, by its file and export, which only the running Storybook knows the id of:
 * once found, the page's address takes Storybook's own, `?path=/story/<id>` (R2).
 */
function ToStory({ folder, story }: { folder: string; story: StoryTarget }) {
  const record = useStory(folder, story);
  const here = useRepoPath();
  const found = record?.state === "ready" ? record.storybook : null;
  useLayoutEffect(() => {
    if (found) {
      redirect(here(found));
    }
  }, [found, here]);
  if (record?.state === "missing") {
    return (
      <>
        <NoSuchStory story={story} />
        <HStack gap={2} xstyle={styles.controls}>
          <Button href={here(storybookHref(folder))} label="Open in Storybook" size="sm" />
        </HStack>
      </>
    );
  }
  if (record?.state === "failed") {
    return <Failed folder={folder}>{record.error}</Failed>;
  }
  return <Waiting starting={record?.state !== "none"} />;
}

/**
 * A checkout's Storybook, by its folder, `main` for the main checkout: Storybook's interface, at the
 * story of the page's `?path=`, or of its `?story=`; or why it does not show. Without a preview
 * decision, there is no such page.
 */
export function StorybookPage({ folder }: { folder: string }) {
  useRestoreScroll(true);
  const preview = usePreviewOn(folder);
  const story = storyOf(useSearch());
  const { box, height } = useWindowHeight(preview);
  if (!preview) {
    return (
      <Page>
        <Paragraph>Nothing here.</Paragraph>
      </Page>
    );
  }
  return (
    <div ref={box} {...stylex.props(styles.page, height !== undefined && styles.height(height))}>
      <div {...stylex.props(styles.crumbs)}>
        <Crumbs current="Storybook" folder={folder === MAIN_CHECKOUT ? undefined : folder} />
      </div>
      {story ? (
        <ToStory folder={folder} key={`${story.path}#${story.export}`} story={story} />
      ) : (
        <StorybookFrame folder={folder} />
      )}
    </div>
  );
}
