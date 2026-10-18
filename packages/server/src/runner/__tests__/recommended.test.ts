import type { FeatureView, NextView, PullRequestState } from "uraeda-binding";
import { expect, test } from "vite-plus/test";
import { recommendedMessage, runMessage } from "../message.ts";

const branch = "2026-10-11-web-ui";
const feature = { kind: "feature", path: `specs/${branch}` };
const IMPLEMENTATION = "skills/uraeda/references/implementation.md";

/** Where each step waits, and its reference, as the core's step table gives them. */
const STEPS: Record<string, { reference?: string; waitsOn: string }> = {
  change: { reference: "skills/uraeda/references/change.md", waitsOn: "agent" },
  done: { waitsOn: "nobody" },
  finish: { reference: "skills/uraeda/references/finish.md", waitsOn: "agent" },
  "human-gate": { waitsOn: "human" },
  none: { waitsOn: "nobody" },
  plan: { reference: "skills/uraeda/references/plan.md", waitsOn: "agent" },
  "pull-request": { waitsOn: "human" },
  "pull-request-changes": { reference: IMPLEMENTATION, waitsOn: "agent" },
  "pull-request-unknown": { reference: IMPLEMENTATION, waitsOn: "agent" },
};

/** What `recommendedMessage` reads of a feature: its step, its pull request, and its agent. */
function input({
  available = true,
  gate,
  kind = "feature",
  merged = false,
  pullRequest,
  step = "human-gate",
}: {
  available?: boolean;
  gate?: string;
  kind?: string;
  merged?: boolean;
  pullRequest?: PullRequestState;
  step?: string;
}) {
  const path = kind === "change" ? `specs/changes/${branch}` : `specs/${branch}`;
  const view = {
    folder: branch,
    kind,
    path,
    ...(pullRequest === undefined
      ? {}
      : {
          pullRequest: {
            number: 31,
            state: pullRequest,
            url: "https://github.com/o/r/pull/31",
          },
        }),
  } as FeatureView;
  const next: NextView = {
    folder: branch,
    ...(merged ? {} : { branch: kind === "change" ? `change/${branch}` : branch }),
    mainRoot: "/repo",
    step: {
      name: step,
      ...STEPS[step],
      ...(gate === undefined ? {} : { file: gate }),
      ...(pullRequest === undefined ? {} : { pullRequest }),
    },
  };
  return { agent: { available, name: "Claude Code" }, feature: view, next };
}

const WAITS = { reason: "No recommended message: the feature waits on you" };

/** US4.1 */
test("a step waiting on the agent recommends its own message", () => {
  expect(recommendedMessage(input({ step: "plan" }))).toEqual({
    name: "Continue, write the plan",
    step: "plan",
    text: runMessage({
      branch,
      feature,
      reference: "skills/uraeda/references/plan.md",
      step: "plan",
    }),
    trigger: "manual",
  });
});

/** US4.2 */
test("a step waiting on you recommends nothing", () => {
  expect(recommendedMessage(input({ gate: "spec.md" }))).toEqual(WAITS);
});

/** US5.1 */
test("an open pull request recommends its comments", () => {
  const message = recommendedMessage(input({ pullRequest: "open", step: "pull-request" }));
  expect(message).toMatchObject({
    name: "Address the pull request's comments",
    step: "pull-request",
    trigger: "comments",
  });
  expect("text" in message && message.text).toBe(
    `/uraeda Continue the feature specs/${branch}/ on branch ${branch}: ` +
      `Address the comments on its pull request, starting with ${IMPLEMENTATION}.\n` +
      "Stop when the pull request is ready for review again, and earlier only if you need a decision from me.\n",
  );
});

/** US5 more 1, R3 */
test("a draft pull request recommends its comments while the feature waits on you", () => {
  // The folder came back for a round of questions after finishing: the round waits on the human.
  expect(
    recommendedMessage(input({ gate: "clarifications-02.md", pullRequest: "draft" })),
  ).toMatchObject({ name: "Address the pull request's comments", trigger: "comments" });
  // At the finish step, the draft is the one the agent is finishing: its step's message wins.
  expect(recommendedMessage(input({ pullRequest: "draft", step: "finish" }))).toMatchObject({
    name: "Continue, finish it",
    step: "finish",
    trigger: "manual",
  });
});

test("a change's comments start from the change reference", () => {
  const message = recommendedMessage(
    input({ kind: "change", pullRequest: "open", step: "pull-request" }),
  );
  expect(message).toMatchObject({ trigger: "comments" });
  expect("text" in message && message.text).toContain(
    `the change specs/changes/${branch}/ on branch change/${branch}: ` +
      "Address the comments on its pull request, starting with skills/uraeda/references/change.md.",
  );
});

test("changes requested on the pull request recommend the comments message", () => {
  const message = recommendedMessage(
    input({ pullRequest: "changes-requested", step: "pull-request-changes" }),
  );
  expect(message).toEqual({
    name: "Address the pull request's comments",
    step: "pull-request-changes",
    text: runMessage({
      branch,
      feature,
      reference: IMPLEMENTATION,
      step: "pull-request-changes",
      trigger: "comments",
    }),
    trigger: "comments",
  });
});

/** Review focus 6 */
test("a merged feature recommends nothing, though its record reads open", () => {
  const merged = input({ merged: true, pullRequest: "open", step: "pull-request" });
  expect(recommendedMessage(merged)).toEqual({
    reason: "This feature has no branch left: it is merged.",
  });
});

test("an unknown pull request state recommends nothing", () => {
  expect(recommendedMessage(input({ step: "pull-request-unknown" }))).toEqual(WAITS);
});

test("without the agent, nothing is recommended", () => {
  expect(recommendedMessage(input({ available: false, step: "plan" }))).toEqual({
    reason: "Claude Code is not available on this machine.",
  });
});

test("a step without a run recommends nothing", () => {
  expect(recommendedMessage(input({ step: "none" }))).toEqual(WAITS);
  expect(recommendedMessage(input({ step: "done" }))).toEqual(WAITS);
});
