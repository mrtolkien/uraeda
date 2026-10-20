// Focused UI tests: one component under the app's own fate client, repository, Suspense, and fetch
// contexts, its requests answered by the server's scripted endpoint. Each case gets a new client
// and endpoint; a request the case did not script fails it.
import { readFileSync } from "node:fs";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { Suspense, useLayoutEffect, useState } from "react";
import { FateClient } from "react-fate";
import { fixture } from "uraeda-binding/test-utils";
import { AGENT_ID } from "uraeda-server/fate";
import {
  type AgentRecord,
  createRequestFixture,
  type RequestFixture,
  type RequestFixtureOptions,
  type SessionRecord,
} from "uraeda-server/request-fixture";
import { afterEach, beforeEach } from "vite-plus/test";
import type { DraftImage } from "../attach/chatImages.ts";
import { ServerFetch } from "../attach/ServerFetch.tsx";
import { fateClients } from "../clients.ts";
import { Composer, type ComposerProps } from "../Composer.tsx";
import { RepositoryContext } from "../routes.tsx";

export { refused } from "uraeda-server/request-fixture";

const REPO = "test";
const ORIGIN = "http://127.0.0.1:4310";

/** happy-dom has no EventSource: live views subscribe, and receive nothing. */
class SilentEventSource {
  readyState = 0;
  url: string;
  constructor(url: string) {
    this.url = url;
  }
  addEventListener() {}
  removeEventListener() {}
  close() {}
}

/** The endpoints of the current case, closed after it: an unscripted request fails the case. */
const fixtures: Array<RequestFixture> = [];
/** The requests the page started, which teardown waits for before closing the endpoint. */
const pending = new Set<Promise<unknown>>();

beforeEach(() => {
  (globalThis as { EventSource?: unknown }).EventSource = SilentEventSource;
});

afterEach(async () => {
  cleanup();
  for (const fail of held) {
    fail(new Error("The case ended before it settled this answer"));
  }
  do {
    await new Promise((resolve) => setImmediate(resolve));
    await Promise.allSettled(pending);
  } while (pending.size > 0);
  for (const endpoint of fixtures.splice(0)) {
    endpoint.close();
  }
});

/** The fake agent as the server describes it: available, and reading images. */
export function agentRecord(overrides: Partial<AgentRecord> = {}): AgentRecord {
  return {
    available: true,
    capabilities: {
      approvals: true,
      images: true,
      queue: true,
      steer: true,
      subagents: true,
      takeBack: true,
    },
    fiveHourLimit: null,
    id: AGENT_ID,
    kind: "fake",
    name: "Claude Code",
    version: null,
    ...overrides,
  };
}

/** An idle chat session, as the server sends one. */
export function sessionRecord(id: string, overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    agent: "fake",
    allowable: 0,
    archived: false,
    backgroundCommands: 0,
    folder: null,
    id,
    place: "main checkout, branch main",
    status: "idle",
    statusLabel: "Idle",
    statusReason: null,
    subagents: [],
    title: "A chat",
    turns: [],
    unseen: false,
    ...overrides,
  };
}

/** A PNG file, as the system's picker gives one. */
export const png = (name: string) =>
  new File([readFileSync(fixture("images/phone.png"))], name, { type: "image/png" });

/** A saved draft image, as `POST /attach` answered it. */
export const savedImage = (id: string, name: string): DraftImage => ({
  image: { height: 10, id, width: 20 },
  key: `saved-${id}`,
  name,
});

/** The answers a case still holds, failed at its end so a failed case never hangs the next. */
const held = new Set<(reason: Error) => void>();

/** A promise the test settles: what an endpoint answers once the case checked the wait. */
export function controlled<T>() {
  const answer = Promise.withResolvers<T>();
  const fail = (reason: Error) => answer.reject(reason);
  held.add(fail);
  void answer.promise.then(
    () => held.delete(fail),
    () => held.delete(fail),
  );
  return answer;
}

type Draft = { images: ReadonlyArray<DraftImage>; value: string };

/**
 * Renders the composer as a page holds it, the draft's text and images in the page's state, under
 * the app's contexts and a new fate client on a scripted endpoint. `draft()` is the page's state
 * now; `endpoint` is the scripted server, whose `requests` say what reached it.
 */
export async function renderComposer(
  props: Partial<Omit<ComposerProps, "images" | "onChange" | "onImagesChange" | "value">>,
  options: Omit<RequestFixtureOptions, "agent" | "repo"> & {
    agent?: AgentRecord;
    images?: ReadonlyArray<DraftImage>;
    value?: string;
  } = {},
) {
  const endpoint = createRequestFixture({
    ...options,
    agent: options.agent ?? agentRecord(),
    repo: REPO,
  });
  fixtures.push(endpoint);
  const fetch: typeof globalThis.fetch = (input, init) => {
    const response = endpoint.fetch(input, init);
    pending.add(response);
    void response.then(
      () => pending.delete(response),
      () => pending.delete(response),
    );
    return response;
  };
  const clientFor = fateClients({ fetch, origin: ORIGIN });
  const state: { current: Draft } = {
    current: { images: options.images ?? [], value: options.value ?? "" },
  };
  const report = (draft: Draft) => {
    state.current = draft;
  };
  function Page() {
    const [value, setValue] = useState(state.current.value);
    const [images, setImages] = useState(state.current.images);
    useLayoutEffect(() => report({ images, value }));
    return (
      <Composer
        {...props}
        images={images}
        onChange={setValue}
        onImagesChange={setImages}
        value={value}
      />
    );
  }
  const rendered = await act(async () =>
    render(
      <ServerFetch fetch={fetch}>
        <RepositoryContext value={REPO}>
          <FateClient client={clientFor(REPO)}>
            <Suspense fallback={<p>Loading</p>}>
              <Page />
            </Suspense>
          </FateClient>
        </RepositoryContext>
      </ServerFetch>,
    ),
  );
  // The composer draws once the agent is read: its name labels the field.
  await waitFor(() => rendered.getByRole("textbox", { name: "Message Claude Code" }));
  return { ...rendered, draft: () => state.current, endpoint };
}

/** Lets the page's requests start and their answers draw. */
export async function settle() {
  await act(async () => {
    do {
      await new Promise((resolve) => setImmediate(resolve));
      await Promise.allSettled(pending);
    } while (pending.size > 0);
  });
}
