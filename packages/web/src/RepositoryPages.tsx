// The pages shown in place of a repository's: its name is not in the list, its folder is gone, or
// the list is empty.
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Code } from "@astryxdesign/core/Code";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Link } from "@astryxdesign/core/Link";
import { VStack } from "@astryxdesign/core/VStack";
import { useState } from "react";
import { useFateClient } from "react-fate";
import { AddRepository } from "./AddRepository.tsx";
import { refusal } from "./errors.ts";
import { Page } from "./layout/Page.tsx";
import { Paragraph } from "./layout/Paragraph.tsx";
import { navigate, repoPath, useRestoreScroll } from "./routes.tsx";
import { BareShell } from "./Shell.tsx";
import { RepositoriesView } from "./views.ts";

/** A URL naming no repository of the list, with a link to the most recently opened one. */
export function UnknownRepository({ name, mostRecent }: { name: string; mostRecent?: string }) {
  useRestoreScroll(true);
  return (
    <BareShell current={null}>
      <Page>
        <VStack gap={3}>
          <Heading level={1}>No repository named “{name}”</Heading>
          <Paragraph>
            It is not in Uraeda's list.{" "}
            {mostRecent === undefined ? (
              <Link href="/" hasUnderline>
                Add a repository
              </Link>
            ) : (
              <Link href={repoPath(mostRecent, "/")} hasUnderline>
                Open {mostRecent}
              </Link>
            )}
          </Paragraph>
        </VStack>
      </Page>
    </BareShell>
  );
}

/**
 * A repository whose folder no longer holds a git repository: where it was, and Remove, which takes
 * it off the list and opens the next one. Its own fate endpoint is never called.
 */
export function MissingFolder({ name, path }: { name: string; path: string }) {
  useRestoreScroll(true);
  const fate = useFateClient();
  const [error, setError] = useState<string>();
  const [removing, setRemoving] = useState(false);
  const remove = async () => {
    setRemoving(true);
    setError(undefined);
    const { error } = await fate.mutations.repositories.remove({
      input: { name },
      view: RepositoriesView,
    });
    setRemoving(false);
    if (error) {
      setError(refusal(error).message);
      return;
    }
    // The root opens the most recently opened repository left, or the first run.
    navigate("/");
  };
  return (
    <BareShell current={name}>
      <Page>
        <VStack gap={3}>
          <Heading level={1}>Folder not found</Heading>
          <Paragraph>
            {name} was at <Code size="inherit">{path}</Code>, which no longer holds a git
            repository. Move it back, or remove it from Uraeda.
          </Paragraph>
          {error && <Banner status="error" title={error} collapsible={false} />}
          <HStack>
            <Button label="Remove from Uraeda" isLoading={removing} onClick={() => void remove()} />
          </HStack>
        </VStack>
      </Page>
    </BareShell>
  );
}

/**
 * The first run, on every page while the list is empty: what Uraeda does, and the add form, in the
 * page, without the navigation.
 */
export function FirstRun() {
  useRestoreScroll(true);
  return (
    <Page>
      <VStack gap={3}>
        <Heading level={1}>Add your first repository</Heading>
        <Paragraph color="secondary">
          Uraeda shows the specs and runs agents in git repositories on this machine.
        </Paragraph>
        <AddRepository inline />
      </VStack>
    </Page>
  );
}
