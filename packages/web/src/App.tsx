import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { LayerProvider } from "@astryxdesign/core/Layer";
import { LinkProvider } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { Theme } from "@astryxdesign/core/theme";
import { uraedaTheme } from "./theme/built/uraeda.js";
import { Component, type ReactNode, Suspense, useLayoutEffect, useState } from "react";
import { FateClient } from "react-fate";
import type { FateClient as Client } from "./clients.ts";
import { useRepositories } from "./data.ts";
import { FeaturePage } from "./FeaturePage.tsx";
import { EditorPage } from "./EditorPage.tsx";
import { FilePage } from "./FilePage.tsx";
import { Home } from "./Home.tsx";
import { MockupPage } from "./MockupPage.tsx";
import { PrioritiesPage } from "./PrioritiesPage.tsx";
import { Page as PageLayout } from "./layout/Page.tsx";
import { Panes } from "./layout/Panes.tsx";
import { useWidthClass } from "./layout/useWidthClass.ts";
import {
  currentEntry,
  navigate,
  RepositoryContext,
  repoPath,
  type Route,
  redirect,
  RouterAnchor,
  useRepoPath,
  useRestoreScroll,
  useRoute,
} from "./routes.tsx";
import { FirstRun, MissingFolder, UnknownRepository } from "./RepositoryPages.tsx";
import { SessionPage } from "./SessionPage.tsx";
import { TaskView } from "./TaskView.tsx";
import { Shell } from "./Shell.tsx";
import { ThemeModeProvider } from "./theme.tsx";
import { Paragraph } from "./layout/Paragraph.tsx";

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
      <PageLayout>
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
      </PageLayout>
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
    case "mockup":
      return <MockupPage folder={route.folder} name={route.name} />;
    case "session":
      return <SessionRoute folder={route.folder} />;
    case "run":
      return <RunRedirect folder={route.folder} id={route.id} />;
    case "chat":
      return <SessionPage key={route.id} id={route.id} />;
    case "new-chat":
      return <SessionPage newChat />;
    case "first-run":
      return <FirstRun />;
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
  const [{ from }] = useState(currentEntry);
  const list = from === "/" ? "/" : "/priorities";
  const here = useRepoPath();
  useListPosition();
  return (
    <Panes
      list={list === "/" ? <Home /> : <PrioritiesPage />}
      detail={<TaskView entryKey={entryKey} />}
      onCloseDetail={() => navigate(here(list))}
    />
  );
}

/**
 * On wide screens, keeps the list beside a detail where it was when the detail was opened, unless
 * the entry has a position of its own.
 */
function useListPosition() {
  // Once, when the view is drawn, at the width it is drawn at: the entry is read once too.
  const width = useWidthClass();
  const [wide] = useState(width === "wide");
  const [{ opener, scroll }] = useState(currentEntry);
  useLayoutEffect(() => {
    if (wide && scroll === undefined && opener !== undefined) {
      window.scrollTo(0, opener);
    }
  }, [wide, opener, scroll]);
}

/**
 * A feature's session: on wide screens, in a pane beside its feature's page; on narrow screens, a
 * page of its own.
 */
function SessionRoute({ folder }: { folder: string }) {
  const here = useRepoPath();
  useListPosition();
  return (
    <Panes
      list={<FeaturePage folder={folder} />}
      detail={<SessionPage folder={folder} />}
      onCloseDetail={() => navigate(here(`/f/${encodeURIComponent(folder)}`))}
    />
  );
}

/** An old run's address: its feature's session, at the turn the run became. */
function RunRedirect({ folder, id }: { folder: string; id: string }) {
  const here = useRepoPath();
  useLayoutEffect(() => {
    redirect(here(`/f/${encodeURIComponent(folder)}/session#turn-${encodeURIComponent(id)}`));
  }, [here, folder, id]);
  return null;
}

function Nothing() {
  useRestoreScroll(true);
  return (
    <PageLayout>
      <Paragraph>Nothing here.</Paragraph>
    </PageLayout>
  );
}

function Loading() {
  return (
    <PageLayout>
      <Text color="secondary">Loading…</Text>
    </PageLayout>
  );
}

/**
 * A path without a repository, from before repositories had names: the same page in the most
 * recently opened repository, or the first run when the list is empty.
 */
function ToMostRecent({ name, pathname }: { name?: string; pathname: string }) {
  useLayoutEffect(() => {
    if (name !== undefined) {
      redirect(`${repoPath(name, pathname)}${window.location.search}${window.location.hash}`);
    }
  }, [name, pathname]);
  return name === undefined ? <FirstRun /> : null;
}

/**
 * The repository the URL names, from the list the global client reads: its pages, on its own fate
 * client, under its name; or why it cannot be shown, without sending it a request.
 */
function InRepository({
  repo,
  pathname,
  clientFor,
  children,
}: {
  repo: string | null;
  pathname: string;
  clientFor: (repo: string | null) => Client;
  children: ReactNode;
}) {
  const rows = useRepositories()?.rows ?? [];
  const mostRecent = rows[0]?.name;
  if (repo === null) {
    return <ToMostRecent name={mostRecent} pathname={pathname} />;
  }
  const row = rows.find((candidate) => candidate.name === repo);
  if (!row) {
    return <UnknownRepository name={repo} mostRecent={mostRecent} />;
  }
  if (row.missing) {
    return <MissingFolder name={row.name} path={row.path} />;
  }
  return (
    <RepositoryContext value={repo}>
      <FateClient key={repo} client={clientFor(repo)}>
        {children}
      </FateClient>
    </RepositoryContext>
  );
}

/**
 * The UI: the list of repositories through the global client, `clientFor(null)`, and the page of
 * the repository the URL names through its own, `clientFor(<name>)`, its tree drawn anew for each
 * repository.
 */
export function App({ clientFor }: { clientFor: (repo: string | null) => Client }) {
  const { repo, route, pathname } = useRoute();
  const [attempt, setAttempt] = useState(0);
  return (
    <FateClient client={clientFor(null)}>
      <ThemeModeProvider>
        {(mode) => (
          <Theme theme={uraedaTheme} mode={mode}>
            <LinkProvider component={RouterAnchor}>
              <LayerProvider toast={{ position: "bottomEnd" }}>
                <ServerErrorBoundary key={attempt} onRetry={() => setAttempt((n) => n + 1)}>
                  <Suspense fallback={<Loading />}>
                    <InRepository repo={repo} pathname={pathname} clientFor={clientFor}>
                      <Suspense fallback={<Loading />}>
                        <Shell>
                          <Suspense fallback={<Loading />}>
                            <Page key={pathname} route={route} />
                          </Suspense>
                        </Shell>
                      </Suspense>
                    </InRepository>
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
