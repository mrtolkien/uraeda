// The web UI is compiled with React Compiler, in its tests as in its build: a component whose
// props did not change is memoized, without `memo` written by hand.
import { Button } from "@astryxdesign/core/Button";
import { render, screen } from "@testing-library/react";
import { useState } from "react";
import { expect, test, vi } from "vite-plus/test";
import { click } from "./helpers.tsx";

const renders = vi.fn();

function Child({ label }: { label: string }) {
  renders();
  return <span>{label}</span>;
}

function Parent() {
  const [count, setCount] = useState(0);
  return (
    <>
      <Button clickAction={() => setCount(count + 1)} label={String(count)} />
      <Child label="fixed" />
    </>
  );
}

test("a component whose props did not change does not render again (React Compiler)", async () => {
  render(<Parent />);
  await click(screen.getByRole("button", { name: "0" }));
  expect(screen.getByRole("button", { name: "1" })).toBeTruthy();
  expect(renders).toHaveBeenCalledTimes(1);
});
