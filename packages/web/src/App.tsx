import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { LayerProvider } from "@astryxdesign/core/Layer";
import { Theme } from "@astryxdesign/core/theme";
import { uraedaTheme } from "./theme/built/uraeda.js";
import { Component, type ReactNode, Suspense, useState } from "react";
import { FateClient } from "react-fate";
import type { createFateClient } from "react-fate/client";
import { FeaturePage } from "./FeaturePage.tsx";
import { EditorPage } from "./EditorPage.tsx";
import { FilePage } from "./FilePage.tsx";
import { Home } from "./Home.tsx";
import { PrioritiesPage } from "./PrioritiesPage.tsx";
import { type Route, useRestoreScroll, useRoute } from "./routes.tsx";
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
    case "edit":
      return <EditorPage key={route.path} path={route.path} />;
    default:
      return <Nothing />;
  }
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
          </Theme>
        )}
      </ThemeModeProvider>
    </FateClient>
  );
}
