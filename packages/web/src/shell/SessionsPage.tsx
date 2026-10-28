// `/sessions`, the phone's Sessions tab: what the column holds that the tabs do not. The repository
// menu, then the shell's panes, Needs you, Sessions, and In progress, then Done, dimmed as what is
// over, beside the 5 h window from semi-wide up. On a wider screen, the same panes as the column's.
// `j k` and the arrows move along the cards as along a list's rows, the one they reach tinted as a
// selected row, and Enter opens it; the mouse moving over a card takes them to it too.
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { type PointerEvent, type RefObject, useRef, useState } from "react";
import { Columns } from "../home/parts.tsx";
import { useKeys } from "../keys/registry.tsx";
import { Page } from "../layout/Page.tsx";
import { PageTitle } from "../layout/PageTitle.tsx";
import { PickedCard } from "../layout/picked.ts";
import { RepositoryMenu } from "../RepositoryMenu.tsx";
import { useRepository } from "../routes.tsx";
import { Allowance } from "../sidebar/Allowance.tsx";
import { useNewKey } from "../useNewKey.ts";
import { ShellDone, ShellPanes } from "./ShellPanes.tsx";

const styles = stylex.create({
  // What is done, apart from what is live: dimmed, its rows still read and opened.
  done: { opacity: 0.6 },
});

/** The links the keys move along: each card's, and each done row's, in the page's order. */
const TARGETS = "[data-card] a[href], [data-done-area] a[href]";

/**
 * The address of the card's or the done row's link that has the focus, which the keys or the
 * pointer moved to it: that card is the one picked (`PickedCard`), none once the focus left them.
 */
function pickedOf(target: EventTarget | null) {
  const link = (target as Element | null)?.closest?.("a[href]");
  return link?.closest("[data-card], [data-done-area]")
    ? (link.getAttribute("href") ?? undefined)
    : undefined;
}

/** `j k` and the arrows, along `page`'s cards: from the one with the focus, or the last one. */
function useCardKeys(page: RefObject<HTMLDivElement | null>) {
  const last = useRef<HTMLElement>(null);
  const step = (by: 1 | -1) => () => {
    const links = [...(page.current?.querySelectorAll<HTMLElement>(TARGETS) ?? [])];
    if (links.length === 0) {
      return false;
    }
    const from = links.indexOf(document.activeElement as HTMLElement);
    const at = from === -1 ? links.indexOf(last.current as HTMLElement) : from;
    const to = at === -1 ? 0 : Math.min(Math.max(at + by, 0), links.length - 1);
    links[to]?.focus();
    links[to]?.scrollIntoView({ block: "nearest" });
    last.current = links[to] ?? null;
    return undefined;
  };
  useKeys([
    { hint: "j k", keys: "j", label: "move", run: step(1) },
    { keys: "ArrowDown", label: "next card", run: step(1) },
    { keys: "k", label: "previous card", run: step(-1) },
    { keys: "ArrowUp", label: "previous card", run: step(-1) },
  ]);
  /** The mouse moving over a card or a row takes the focus to it, as over a list's row. */
  return (event: PointerEvent) => {
    if (event.pointerType !== "mouse" || (event.movementX === 0 && event.movementY === 0)) {
      return;
    }
    const target = event.target as Element;
    const link =
      target.closest("[data-card]")?.querySelector<HTMLElement>("a[href]") ??
      target.closest<HTMLElement>("[data-done-area] a[href]");
    if (link && document.activeElement !== link) {
      link.focus({ preventScroll: true });
      last.current = link;
    }
  };
}

export function SessionsPage() {
  const current = useRepository();
  const page = useRef<HTMLDivElement>(null);
  const onPointerMove = useCardKeys(page);
  const [picked, setPicked] = useState<string>();
  useNewKey();
  return (
    <Page isTight>
      {/* The pointer takes the focus to its cards' links, as the keys do. */}
      <div
        onBlur={() => setPicked(undefined)}
        onFocus={(event) => setPicked(pickedOf(event.target))}
        onPointerMove={onPointerMove}
        ref={page}
      >
        <PickedCard value={picked}>
          <VStack gap={3}>
            <RepositoryMenu current={current} hasLogo />
            <PageTitle>Sessions</PageTitle>
            <VStack gap={1}>
              <ShellPanes hasDone={false} query="" />
              <Columns>
                <div {...stylex.props(styles.done)}>
                  <ShellDone />
                </div>
                <Allowance />
              </Columns>
            </VStack>
          </VStack>
        </PickedCard>
      </div>
    </Page>
  );
}
