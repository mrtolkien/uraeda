// An HTML mockup a workflow file links alone in its paragraph, live in its window: the page served
// from the repository, with the link's query and anchor, at the width its `?w=` names, in the same
// sandbox as the mockup page's frame. A mockup that does not load says so, with a link to its page.
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Link } from "@astryxdesign/core/Link";
import { useEffect, useRef, useState } from "react";
import type { MockupEmbed as Mockup } from "uraeda-binding";
import { isNarrow, useWidthClass } from "./layout/useWidthClass.ts";
import { type Fit, LiveFrame, useSeen } from "./LiveFrame.tsx";
import { FullScreenButton, LiveWindow, useLiveWindow } from "./LiveWindow.tsx";
import { useServerFetch } from "./attach/ServerFetch.tsx";
import { useRepoPath } from "./routes.tsx";
import { State } from "./StoryEmbed.tsx";

/** The mockup page's sandbox: scripts, and nothing of Uraeda's origin. */
const SANDBOX = "allow-scripts";

/** A path's segments, each encoded for an address, its slashes kept. */
const encodedPath = (path: string) => path.split("/").map(encodeURIComponent).join("/");

/** The served mockup's address, then the link's query and anchor, which the path never holds. */
function sourceOf(here: (path: string) => string, mockup: Mockup) {
  const path = encodedPath(mockup.path);
  const query = mockup.query ? `?${mockup.query}` : "";
  const anchor = mockup.anchor ? `#${mockup.anchor}` : "";
  return `${here(`/mockups/${path}`)}${query}${anchor}`;
}

/**
 * The mockup's page in the UI, `/f/<folder>/mockups/<name>`, for a mockup of the folder's own
 * `mockups/`; else the served page itself.
 */
export function pageOf(here: (path: string) => string, folder: string, mockup: Mockup) {
  const own = `specs/${folder}/mockups/`;
  return mockup.path.startsWith(own)
    ? here(`/f/${encodeURIComponent(folder)}/mockups/${encodedPath(mockup.path.slice(own.length))}`)
    : here(`/mockups/${encodedPath(mockup.path)}`);
}

/**
 * Whether the served mockup answers, asked once its window is seen: undefined until then and while
 * asked, then whether it was found. Its frame cannot tell, sandboxed from Uraeda's origin. A network
 * error tells nothing: the mockup stays drawn, asked again once the browser is back online.
 */
function useFound(source: string, seen: boolean) {
  const fetch = useServerFetch();
  const [found, setFound] = useState<{ found: boolean; source: string }>();
  const [tries, setTries] = useState(0);
  const known = found?.source === source;
  useEffect(() => {
    if (!seen || known) {
      return;
    }
    let live = true;
    const retry = () => setTries((count) => count + 1);
    // fetch follows a redirect, as the 303 to the secret path: the status is the page's own, and
    // 400 or more, it is missing.
    fetch(source.split("#")[0]!, { method: "HEAD" }).then(
      (answer) => live && setFound({ found: answer.status < 400, source }),
      () => live && window.addEventListener("online", retry, { once: true }),
    );
    return () => {
      live = false;
      window.removeEventListener("online", retry);
    };
  }, [fetch, known, seen, source, tries]);
  return known ? found.found : undefined;
}

/**
 * An HTML mockup's paragraph, by its checkout's folder: its page live in a window. `id` lets a page
 * scroll to it.
 */
export function MockupEmbed({
  folder,
  id,
  mockup,
}: {
  folder: string;
  id?: string;
  mockup: Mockup;
}) {
  const wide = !isNarrow(useWidthClass());
  const live = useLiveWindow(wide, mockup.width);
  const here = useRepoPath();
  const stage = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<Fit>();
  const source = sourceOf(here, mockup);
  const page = pageOf(here, folder, mockup);
  const found = useFound(source, useSeen(stage));
  const actions = (
    <>
      {found && <FullScreenButton screen={live.screen} />}
      {found !== false && !live.screen.full && (
        <IconButton
          href={page}
          icon={<Icon icon="externalLink" />}
          label="Open the mockup's page"
          size="sm"
          variant="ghost"
        />
      )}
    </>
  );
  return (
    <LiveWindow
      actions={actions}
      fit={found ? fit : undefined}
      id={id}
      label={mockup.label}
      live={live}
      wide={wide}
    >
      {found === false ? (
        <State error>
          <span>This mockup could not be loaded.</span>{" "}
          <Link href={page}>Open the mockup&apos;s page</Link>
        </State>
      ) : (
        <LiveFrame
          asked="max"
          full={live.screen.full}
          onFit={setFit}
          sandbox={SANDBOX}
          src={source}
          stage={stage}
          title={`${mockup.label}, ${mockup.width} px`}
          width={mockup.width}
        />
      )}
    </LiveWindow>
  );
}
