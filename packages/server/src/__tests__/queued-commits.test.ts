// A feature whose commits are still queued: the composer's message reads the step they will give,
// and what is sent to the feature waits for them to land.
import { expect, test, vi } from "vite-plus/test";
import { REFUSALS } from "../runner/sessions.ts";
import { heldHook } from "./held-hook.ts";
import { byId, mutate, testServer } from "./helpers.ts";

type Server = Awaited<ReturnType<typeof testServer>>;

const FOLDER = "2026-10-06-recurring-tasks";
const MESSAGE_FIELDS = ["id", "refusal", "step", "text"];

/** The server, its repository's queue, and a hook holding its commits. */
async function heldServer() {
  const server = await testServer();
  const host = server.hosts.get(server.name)!;
  return { hook: heldHook(server.repo), host, server };
}

/** The workflow message of the feature's approval, as the composer reads it. */
async function approvalMessage(server: Server) {
  const [message] = await byId(
    server.app,
    "WorkflowMessage",
    [`${FOLDER}:approval`],
    MESSAGE_FIELDS,
  );
  return message;
}

const approve = (server: Server) =>
  mutate(server.app, "review.approve", { file: "spec.md", folder: FOLDER }, ["id", "status"]);

test("an approval still landing has the composer read the step it gives", async () => {
  const { hook, host, server } = await heldServer();
  expect(await approvalMessage(server)).toMatchObject({ refusal: REFUSALS.human, text: "" });
  const update = vi.spyOn(host.live, "update");

  expect((await approve(server)).error).toBeUndefined();

  const expected = await approvalMessage(server);
  expect(expected).toMatchObject({ refusal: null, step: "plan" });
  expect(expected.text).toContain("references/plan.md");
  hook.release();
  await host.queue.idle();
  // The landing sends the message again, which now reads the branch's step, the same.
  expect(update).toHaveBeenCalledWith("WorkflowMessage", `${FOLDER}:approval`, expect.anything());
  expect(update).toHaveBeenCalledWith("Feature", FOLDER, expect.anything());
  expect(await approvalMessage(server)).toEqual(expected);
});
