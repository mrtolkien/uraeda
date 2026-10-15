// A story embedded where a workflow file links it: the story running in the checkout's Storybook,
// through Uraeda's own address, at a phone and a desktop width on wide screens and at the phone's
// alone on narrow ones, in Uraeda's colour mode. Its frames are sandboxed without
// `allow-same-origin`: the embed takes messages from their windows only, and sends them nothing
// but the colour mode.
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Text } from "@astryxdesign/core/Text";
import { useTheme } from "@astryxdesign/core/theme";
import {
  borderVars,
  colorVars,
  radiusVars,
  spacingVars,
} from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import {
  type ReactNode,
  type RefObject,
  Suspense,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useFateClient } from "react-fate";
import type { StoryTarget } from "uraeda-binding";
import { useStory } from "./data.ts";
import { refusal } from "./errors.ts";
import { useWidthClass } from "./layout/useWidthClass.ts";
import { useRepoPath } from "./routes.tsx";
import { storybookHref } from "./stories.tsx";
import { PreviewView } from "./views.ts";

const styles = stylex.create({
  bar: {
    alignItems: "center",
    borderBlockEndColor: colorVars["--color-border"],
    borderBlockEndStyle: "solid",
    borderBlockEndWidth: borderVars["--border-width"],
    display: "flex",
    flexWrap: "wrap",
    gap: spacingVars["--spacing-2"],
    paddingBlock: spacingVars["--spacing-2"],
    paddingInline: spacingVars["--spacing-3"],
  },
  // On narrow screens, the embed takes the page's inset back: the phone's width is the screen's.
  bleed: {
    borderInlineWidth: 0,
    borderRadius: 0,
    marginInline: `calc(-1 * ${spacingVars["--spacing-4"]})`,
  },
  desktop: {
    insetBlockStart: 0,
    insetInlineStart: 0,
    position: "absolute",
    transformOrigin: "0 0",
    width: "var(--size-story-desktop)",
  },
  embed: {
    backgroundColor: colorVars["--color-background-surface"],
    borderColor: colorVars["--color-border"],
    borderRadius: radiusVars["--radius-container"],
    borderStyle: "solid",
    borderWidth: borderVars["--border-width"],
    marginBlockEnd: spacingVars["--spacing-3"],
    marginBlockStart: 0,
    marginInline: 0,
    overflow: "hidden",
  },
  error: {
    backgroundColor: colorVars["--color-background-red"],
  },
  frame: {
    borderWidth: 0,
    display: "block",
    height: "var(--size-story-height)",
  },
  frames: {
    alignItems: "flex-start",
    backgroundColor: colorVars["--color-background-muted"],
    display: "flex",
    gap: spacingVars["--spacing-4"],
    padding: spacingVars["--spacing-4"],
  },
  framesNarrow: {
    padding: 0,
  },
  // A frame's height, as its story reported it.
  height: (height: string) => ({ height }),
  hidden: { visibility: "hidden" },
  label: {
    marginInlineEnd: "auto",
  },
  phone: {
    flexShrink: 0,
    width: "var(--size-story-phone)",
  },
  phoneNarrow: {
    width: "100%",
  },
  scale: (transform: string) => ({ transform }),
  // The desktop frame's box: the space left, as tall as the scaled frame.
  scaledBox: {
    flexGrow: 1,
    minWidth: 0,
    overflow: "hidden",
    position: "relative",
  },
  state: {
    paddingBlock: spacingVars["--spacing-6"],
    paddingInline: spacingVars["--spacing-4"],
  },
});

/** The widths a wide screen shows a story at. */
type Widths = "both" | "phone" | "desktop";

/** The frames of a story, by width. */
type Width = "phone" | "desktop";

/** A message from a frame, which the embed reads only from its own frames' windows. */
type FrameMessage = { height?: unknown; uraeda: unknown };

const SANDBOX = "allow-scripts allow-popups";

/** Whether a message is the pick script's: an object with a `uraeda` field. */
function isFrameMessage(data: unknown): data is FrameMessage {
  return typeof data === "object" && data !== null && "uraeda" in data;
}

/** A story's height, when its `size` message gives a finite number above 0. */
function heightOf(message: FrameMessage): number | undefined {
  const { height } = message;
  return typeof height === "number" && Number.isFinite(height) && height > 0 ? height : undefined;
}

/**
 * The frames' windows, and the heights their stories report. A frame that says `ready`, again after
 * a reload, is sent the colour mode, which every frame is sent again when it changes.
 */
function useFrames() {
  const phone = useRef<HTMLIFrameElement>(null);
  const desktop = useRef<HTMLIFrameElement>(null);
  const [heights, setHeights] = useState<Partial<Record<Width, number>>>({});
  const { mode } = useTheme();
  useEffect(() => {
    const frames: Record<Width, RefObject<HTMLIFrameElement | null>> = { desktop, phone };
    const onMessage = (event: MessageEvent) => {
      const width = (["phone", "desktop"] as const).find(
        (name) => event.source !== null && frames[name].current?.contentWindow === event.source,
      );
      if (width === undefined || !isFrameMessage(event.data)) {
        return;
      }
      if (event.data.uraeda === "ready") {
        (event.source as Window).postMessage({ mode, uraeda: "mode" }, "*");
      } else if (event.data.uraeda === "size") {
        const height = heightOf(event.data);
        if (height !== undefined) {
          setHeights((known) => ({ ...known, [width]: height }));
        }
      }
    };
    window.addEventListener("message", onMessage);
    for (const frame of [phone, desktop]) {
      frame.current?.contentWindow?.postMessage({ mode, uraeda: "mode" }, "*");
    }
    return () => window.removeEventListener("message", onMessage);
  }, [mode]);
  return { desktop, heights, phone };
}

/** The desktop frame, 1440 px wide, scaled to the space left, its box as tall as it shows. */
function DesktopFrame({
  frameRef,
  height,
  src,
  title,
}: {
  frameRef: RefObject<HTMLIFrameElement | null>;
  height: number | undefined;
  src: string;
  title: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<{ height: number; scale: number }>();
  useLayoutEffect(() => {
    const outer = box.current;
    const frame = frameRef.current;
    if (!outer || !frame) {
      return;
    }
    const measure = () => {
      const scale = outer.clientWidth / frame.offsetWidth;
      const shown = frame.offsetHeight * scale;
      setFit((known) =>
        known?.scale === scale && known.height === shown ? known : { height: shown, scale },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(outer);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [frameRef]);
  return (
    <div ref={box} {...stylex.props(styles.scaledBox, fit && styles.height(`${fit.height}px`))}>
      <iframe
        ref={frameRef}
        sandbox={SANDBOX}
        src={src}
        title={title}
        {...stylex.props(
          styles.frame,
          styles.desktop,
          height !== undefined && styles.height(`${height}px`),
          fit ? styles.scale(`scale(${fit.scale})`) : styles.hidden,
        )}
      />
    </div>
  );
}

/** The story's frames: the widths chosen on wide screens, the phone's alone on narrow ones. */
function StoryFrames({
  label,
  src,
  wide,
  widths,
}: {
  label: string;
  src: string;
  wide: boolean;
  widths: Widths;
}) {
  const { desktop, heights, phone } = useFrames();
  return (
    <div {...stylex.props(styles.frames, !wide && styles.framesNarrow)}>
      {(!wide || widths !== "desktop") && (
        <iframe
          ref={phone}
          sandbox={SANDBOX}
          src={src}
          title={`${label}, phone`}
          {...stylex.props(
            styles.frame,
            wide ? styles.phone : styles.phoneNarrow,
            heights.phone !== undefined && styles.height(`${heights.phone}px`),
          )}
        />
      )}
      {wide && widths !== "phone" && (
        <DesktopFrame
          frameRef={desktop}
          height={heights.desktop}
          src={src}
          title={`${label}, desktop`}
        />
      )}
    </div>
  );
}

/** "Open in Storybook", at a page of Uraeda's: a named icon on narrow screens. */
function OpenInStorybook({ href, wide }: { href: string; wide: boolean }) {
  const here = useRepoPath();
  return wide ? (
    <Button href={here(href)} label="Open in Storybook" size="sm" />
  ) : (
    <IconButton
      href={here(href)}
      icon={<Icon icon="externalLink" />}
      label="Open in Storybook"
      size="sm"
    />
  );
}

/** The embed's bar: its label, then its controls. */
function Bar({
  children,
  label,
  labelId,
}: {
  children?: ReactNode;
  label: string;
  labelId: string;
}) {
  return (
    <div {...stylex.props(styles.bar)}>
      <Text id={labelId} weight="semibold" xstyle={styles.label}>
        {label}
      </Text>
      {children}
    </div>
  );
}

/** Why the story does not show. */
function State({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return (
    <div {...stylex.props(styles.state, error && styles.error)}>
      <Text color={error ? "error" : "secondary"}>{children}</Text>
    </div>
  );
}

/** "Try again": restarts the checkout's Storybook, whose updates reach the story. */
function TryAgain({ folder }: { folder: string }) {
  const fate = useFateClient();
  const [message, setMessage] = useState<string>();
  const restart = async () => {
    setMessage(undefined);
    const result = await fate.mutations.preview.restart({ input: { folder }, view: PreviewView });
    if (result.error) {
      setMessage(refusal(result.error).message);
    }
  };
  return (
    <>
      <Button clickAction={restart} label="Try again" size="sm" />
      {message && <Text color="error">{message}</Text>}
    </>
  );
}

/** The story as its record says: starting, failed, missing, without a worktree, or running. */
function LiveStory({
  folder,
  label,
  labelId,
  story,
}: {
  folder: string;
  label: string;
  labelId: string;
  story: StoryTarget;
}) {
  const record = useStory(folder, story);
  const wide = useWidthClass() === "wide";
  const [widths, setWidths] = useState<Widths>("both");
  if (record?.state === "ready" && record.frame && record.storybook) {
    return (
      <>
        <Bar label={label} labelId={labelId}>
          {wide && (
            <SegmentedControl
              label="Width"
              onChange={(value: string) => setWidths(value as Widths)}
              size="sm"
              value={widths}
            >
              <SegmentedControlItem label="Both" value="both" />
              <SegmentedControlItem label="Phone" value="phone" />
              <SegmentedControlItem label="Desktop" value="desktop" />
            </SegmentedControl>
          )}
          <OpenInStorybook href={record.storybook} wide={wide} />
        </Bar>
        <StoryFrames label={label} src={record.frame} wide={wide} widths={widths} />
      </>
    );
  }
  if (record?.state === "failed") {
    return (
      <>
        <Bar label={label} labelId={labelId}>
          <TryAgain folder={folder} />
        </Bar>
        <State error>{record.error}</State>
      </>
    );
  }
  if (record?.state === "missing") {
    return (
      <>
        <Bar label={label} labelId={labelId}>
          <OpenInStorybook href={storybookHref(folder)} wide={wide} />
        </Bar>
        <State>
          No story “{story.export}” in {story.path} on this branch.
        </State>
      </>
    );
  }
  return (
    <>
      <Bar label={label} labelId={labelId} />
      <State>
        {record?.state === "starting"
          ? "Starting Storybook for this branch…"
          : "This feature has no worktree, so its stories cannot run here."}
      </State>
    </>
  );
}

/**
 * A story link alone in its paragraph, by its checkout's folder, `main` for the main checkout: a
 * figure named by its label, showing the story live once its Storybook runs, or why it does not.
 * `removed`, for a variant removed after its round was answered, reads nothing. `comment` saves a
 * comment on the story, where the page can take one.
 */
export function StoryEmbed({
  folder,
  removed = false,
  story,
}: {
  comment?: (text: string) => Promise<string | undefined>;
  folder: string;
  removed?: boolean;
  story: StoryTarget & { label: string };
}) {
  const labelId = useId();
  const wide = useWidthClass() === "wide";
  const target = { export: story.export, path: story.path };
  return (
    <figure aria-labelledby={labelId} {...stylex.props(styles.embed, !wide && styles.bleed)}>
      {removed ? (
        <>
          <Bar label={story.label} labelId={labelId} />
          <State>This variant was removed after your answer.</State>
        </>
      ) : (
        <Suspense fallback={<Bar label={story.label} labelId={labelId} />}>
          <LiveStory folder={folder} label={story.label} labelId={labelId} story={target} />
        </Suspense>
      )}
    </figure>
  );
}
