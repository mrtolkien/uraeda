import { Heading } from "@astryxdesign/core/Heading";
import { Stack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Component, type ReactNode, Suspense } from "react";
import { FateClient } from "react-fate";
import type { createFateClient } from "react-fate/client";
import { TemporaryStatusPage } from "./TemporaryStatusPage.tsx";

export function App({ client }: { client: ReturnType<typeof createFateClient> }) {
  return (
    <FateClient client={client}>
      <Stack gap={4} padding={6} maxWidth={720}>
        <Text type="label">Uraeda</Text>
        <Heading level={1}>Specs</Heading>
        <ServerErrorBoundary>
          <Suspense fallback={<Text type="supporting">Loading…</Text>}>
            <TemporaryStatusPage />
          </Suspense>
        </ServerErrorBoundary>
      </Stack>
    </FateClient>
  );
}

/** Shows that the server could not be reached when a request fails. */
class ServerErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? (
      <Text color="secondary">Could not reach the Uraeda server.</Text>
    ) : (
      this.props.children
    );
  }
}
