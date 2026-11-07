// Where the shell's top bar ends: the phone's tabs, found by their role, as `Shell.tsx` draws them.
// Wider screens draw no bar, and a bar slid out of the window on the scroll takes no room either.

/** The bottom of the top bar in the window, in px: 0 where none is drawn, or it slid out. */
export function topBarBottom(): number {
  const bar = document.querySelector('[role="banner"]');
  if (bar === null || bar.getClientRects().length === 0) {
    return 0;
  }
  return Math.max(bar.getBoundingClientRect().bottom, 0);
}
