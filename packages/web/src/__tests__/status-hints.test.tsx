// The status line's registry of hints (R20): each declarer keeps its place in the line as its hints
// change, and a list's Escape hint says what Escape does there, or is left out where it does nothing.
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vite-plus/test";
import { useListKeys } from "../lists/useListKeys.ts";
import {
  type StatusHint,
  StatusHintsProvider,
  useDeclaredHints,
  useStatusHints,
} from "../statusHints.tsx";

afterEach(cleanup);

/** The hints' text. */
const line = () => screen.getByRole("note", { name: "Hints" });

/** The hints declared, as the status line reads them. */
function Line() {
  return (
    <p aria-label="Hints" role="note">
      {useDeclaredHints()
        .map((hint) => `${hint.keys} ${hint.label}`)
        .join(" · ")}
    </p>
  );
}

function Declarer({ hints }: { hints: ReadonlyArray<StatusHint> }) {
  useStatusHints(hints);
  return null;
}

function Page({ first }: { first: ReadonlyArray<StatusHint> }) {
  return (
    <StatusHintsProvider>
      <Declarer hints={first} />
      <Declarer hints={[{ keys: "n p", label: "unanswered" }]} />
      <Line />
    </StatusHintsProvider>
  );
}

test("a declarer whose hints change keeps its place before the others", async () => {
  const { rerender } = render(<Page first={[{ keys: "j k", label: "move" }]} />);
  expect(line().textContent).toBe("j k move · n p unanswered");

  await act(async () => {
    rerender(
      <Page
        first={[
          { keys: "j k", label: "move" },
          { keys: "⏎", label: "open" },
        ]}
      />,
    );
  });

  expect(line().textContent).toBe("j k move · ⏎ open · n p unanswered");
});

function List({ escape }: { escape?: string | null }) {
  const { ref } = useListKeys({
    ...(escape === undefined ? {} : { escapeLabel: escape }),
    onClose: () => false,
    onEdit: () => false,
    onSelect: () => {},
    selected: -1,
  });
  return <div ref={ref} />;
}

function ListPage({ escape }: { escape?: string | null }) {
  return (
    <StatusHintsProvider>
      <List escape={escape} />
      <Line />
    </StatusHintsProvider>
  );
}

test("a list's Escape hint names what Escape does, and is left out where it does nothing", async () => {
  const { rerender } = render(<ListPage />);
  expect(line().textContent).toBe("j k move · ⏎ open · esc close");

  await act(async () => {
    rerender(<ListPage escape="constitution" />);
  });
  expect(line().textContent).toBe("j k move · ⏎ open · esc constitution");

  await act(async () => {
    rerender(<ListPage escape={null} />);
  });
  expect(line().textContent).toBe("j k move · ⏎ open");
});
