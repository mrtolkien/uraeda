// A spec's page asks for its data model with the spec, not once the spec is in, and mounts its
// parts below the opening in steps, all of them once drawn.
import { screen, waitFor } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { fixtureRepo, renderPage, serverFetch, today } from "./helpers.tsx";

const FOLDER = "2026-10-06-recurring-tasks";

today("2026-10-11");

// Break: the data model read only by the part that draws it.
test("a spec's page asks for its data model before the spec answers", async () => {
  const repo = fixtureRepo();
  const server = serverFetch(repo);
  const asked: Array<string> = [];
  const spec = Promise.withResolvers<void>();
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const body = typeof init?.body === "string" ? init.body : "";
    asked.push(body);
    if (body.includes(`"${FOLDER}/spec.md"`) && !body.includes('"subscribe"')) {
      await spec.promise;
    }
    return server(input, init);
  };
  const page = renderPage(`/f/${FOLDER}/spec.md`, repo, { fetch });

  await waitFor(() =>
    expect(asked.some((body) => body.includes(`"${FOLDER}/spec.md"`))).toBe(true),
  );
  expect(asked.some((body) => body.includes(`"${FOLDER}/data-model.md"`))).toBe(true);
  spec.resolve();
  await page;
  await waitFor(() => expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy());
});
