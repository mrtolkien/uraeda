// A round's questions mount one at a time after its first frame, and a round reopened at a
// question mounts every question up to it at once, so it opens there.
import { act, render, screen, waitFor } from "@testing-library/react";
import { useLayoutEffect } from "react";
import { expect, test } from "vite-plus/test";
import { useMountedSteps } from "../layout/useMountedSteps.ts";
import { navigate } from "../routes.tsx";
import { atRepo, renderPage, today } from "./helpers.tsx";

const FOLDER = "2026-10-11-web-ui";
const ROUND = "clarifications-01.md";

today("2026-10-11");

/** Notes how many parts each commit mounted. */
function Steps({
  commits,
  count,
  first,
}: {
  commits: Array<number>;
  count: number;
  first: number;
}) {
  const mounted = useMountedSteps(count, first);
  useLayoutEffect(() => {
    commits.push(mounted);
  }, [commits, mounted]);
  return <p>{mounted}</p>;
}

test("the parts after the first mount one commit at a time", async () => {
  const commits: Array<number> = [];
  await act(async () => render(<Steps commits={commits} count={3} first={1} />));
  expect(commits).toEqual([1, 2, 3]);
  expect(screen.getByText("3")).toBeTruthy();
});

// Break: the round mounting none of its questions at once, whatever it opens at.
test("a round reopened at its saved question opens there, its title focused", async () => {
  const { name } = await renderPage(`/f/${FOLDER}`);
  window.localStorage.setItem(`uraeda.round.${name}/${FOLDER}/${ROUND}`, "Q3");

  await act(async () => navigate(atRepo(`/f/${FOLDER}/${ROUND}`)));

  await waitFor(() => expect(document.activeElement?.id).toBe("Q3-title"));
});
