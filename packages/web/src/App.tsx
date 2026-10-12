import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { LayerProvider } from "@astryxdesign/core/Layer";
import { LinkProvider } from "@astryxdesign/core/Link";
import { Theme } from "@astryxdesign/core/theme";
import { uraedaTheme } from "./theme/built/uraeda.js";
import { Component, type ReactNode, Suspense, useLayoutEffect, useState } from "react";
import { FateClient } from "react-fate";
import type { createFateClient } from "react-fate/client";
import { FeaturePage } from "./FeaturePage.tsx";
import { EditorPage } from "./EditorPage.tsx";
import { FilePage } from "./FilePage.tsx";
import { Home } from "./Home.tsx";
import { PrioritiesPage } from "./PrioritiesPage.tsx";
import { Panes } from "./layout/Panes.tsx";
import { useWidthClass } from "./layout/useWidthClass.ts";
import {
  currentEntry,
  navigate,
  type Route,
  RouterAnchor,
  useRestoreScroll,
  useRoute,
} from "./routes.tsx";
import { TaskView } from "./TaskView.tsx";
import { Shell } from "./Shell.tsx";
import { ThemeModeProvider } from "./theme.tsx";

/** Shows that the server could not be reached, with a way to try again. */
class ServerErrorBoundary extends Component<
  { children: ReactNode; onRetry: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) {
      return this.props.children;
    }
    return (
      <div className="page">
        <Banner
          status="error"
          title="Could not reach the Uraeda server."
          endContent={
            <Button
              label="Try again"
              onClick={() => {
                this.setState({ failed: false });
                this.props.onRetry();
              }}
            />
          }
        />
      </div>
    );
  }
}

function Page({ route }: { route: Route }) {
  switch (route.page) {
    case "home":
      return <Home />;
    case "feature":
      return <FeaturePage folder={route.folder} />;
    case "file":
      return <FilePage folder={route.folder} name={route.name} />;
    case "priorities":
      return <PrioritiesPage />;
    case "task":
      return <TaskRoute entryKey={route.key} />;
    case "edit":
      return <EditorPage key={route.path} path={route.path} />;
    default:
      return <Nothing />;
  }
}

/**
 * A task view: on wide screens, in a pane beside the list it was opened from, home or the
 * priorities page (the priorities page when opened from anywhere else), at the list's position;
 * on narrow screens, a page of its own.
 */
function TaskRoute({ entryKey }: { entryKey: string }) {
  const wide = useWidthClass() === "wide";
  const [{ from, opener, scroll }] = useState(currentEntry);
  const list = from === "/" ? "/" : "/priorities";
  useLayoutEffect(() => {
    // The list stays where it was when the line was opened; a position of its own wins.
    if (wide && scroll === undefined && opener !== undefined) {
      window.scrollTo(0, opener);
    }
    // Once, when the view is drawn.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Panes
      list={list === "/" ? <Home /> : <PrioritiesPage />}
      detail={<TaskView entryKey={entryKey} />}
      onCloseDetail={() => navigate(list)}
    />
  );
}

function Nothing() {
  useRestoreScroll(true);
  return (
    <div className="page">
      <p>Nothing here.</p>
    </div>
  );
}

export function App({ client }: { client: ReturnType<typeof createFateClient> }) {
  const { route, pathname } = useRoute();
  const [attempt, setAttempt] = useState(0);
  return (
    <FateClient client={client}>
      <ThemeModeProvider>
        {(mode) => (
          <Theme theme={uraedaTheme} mode={mode}>
            <LinkProvider component={RouterAnchor}>
              <LayerProvider toast={{ position: "bottomEnd" }}>
                <ServerErrorBoundary key={attempt} onRetry={() => setAttempt((n) => n + 1)}>
                  <Suspense fallback={<div className="page muted">Loading…</div>}>
                    <Shell>
                      <Suspense fallback={<div className="page muted">Loading…</div>}>
                        <Page key={pathname} route={route} />
                      </Suspense>
                    </Shell>
                  </Suspense>
                </ServerErrorBoundary>
              </LayerProvider>
            </LinkProvider>
          </Theme>
        )}
      </ThemeModeProvider>
    </FateClient>
  );
}
