// `useAction`, over a fate client of the test's own: its output, its refusal, and no answer kept in
// fate's store once read.
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { FateClient } from "react-fate";
import { expect, test } from "vite-plus/test";
import { ExtensionContext, useAction } from "./hooks.ts";

/** A fate client whose action answers `answer`, and which keeps what the hook deleted. */
function clientAnswering(answer: object) {
  const calls: Array<unknown> = [];
  const deleted: Array<[string, string | number]> = [];
  const client = {
    deleteRecord: (type: string, id: string | number) => void deleted.push([type, id]),
    mutations: {
      extensions: {
        act: async ({ input }: { input: unknown }) => {
          calls.push(input);
          return answer;
        },
      },
    },
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <FateClient client={client as never}>
      <ExtensionContext value="deploy">{children}</ExtensionContext>
    </FateClient>
  );
  return { calls, deleted, wrapper };
}

// Break: the answer left in fate's store, one record per call.
test("an action gives its output, its answer taken out of fate's store", async () => {
  const { calls, deleted, wrapper } = clientAnswering({
    result: { id: "answer-1", outputJson: `{"shipped":true}` },
  });
  const { result } = renderHook(() => useAction<{ to: string }>("ship"), { wrapper });
  expect(await result.current({ to: "prod" })).toEqual({ shipped: true });
  expect(calls).toEqual([{ extension: "deploy", inputJson: `{"to":"prod"}`, name: "ship" }]);
  expect(deleted).toEqual([["ExtensionAction", "answer-1"]]);
});

test("a refused action throws why", async () => {
  const { wrapper } = clientAnswering({
    error: new Error("refused: deploy is not loaded"),
  });
  const { result } = renderHook(() => useAction("ship"), { wrapper });
  await expect(result.current()).rejects.toThrow(/^deploy is not loaded$/);
});

test("useAction outside an extension's page says so", () => {
  expect(() => renderHook(() => useAction("ship"))).toThrow(
    "useAction is called outside an extension's page",
  );
});
