import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Theme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";
import { Component, type ReactNode, Suspense, useState } from "react";
import { FateClient } from "react-fate";
import type { createFateClient } from "react-fate/client";
import { FeaturePage } from "./FeaturePage.tsx";
import { EditorPage } from "./EditorPage.tsx";
import { FilePage } from "./FilePage.tsx";
import { Home } from "./Home.tsx";
import { PrioritiesPage } from "./PrioritiesPage.tsx";
import { type Route, useRoute } from "./routes.tsx";
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
      return (
        <div className="page">
          <p>Nothing here.</p>
        </div>
      );
  }
}

export function App({ client }: { client: ReturnType<typeof createFateClient> }) {
  const route = useRoute();
  const [attempt, setAttempt] = useState(0);
  return (
    <FateClient client={client}>
      <ThemeModeProvider>
        {(mode) => (
          <Theme theme={neutralTheme} mode={mode}>
            <ServerErrorBoundary key={attempt} onRetry={() => setAttempt((n) => n + 1)}>
              <Suspense fallback={<div className="page muted">Loading…</div>}>
                <Shell>
                  <Suspense fallback={<div className="page muted">Loading…</div>}>
                    <Page route={route} />
                  </Suspense>
                </Shell>
              </Suspense>
            </ServerErrorBoundary>
          </Theme>
        )}
      </ThemeModeProvider>
    </FateClient>
  );
}
