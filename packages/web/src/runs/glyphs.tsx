// The run map's own glyphs, Lucide's, which the app's icon set lacks: the scissors of a clean
// session's cut, the lock of a cut the steps' models force, a gate's person, and the merge at the
// map's end. Drawn here as icon components, which Astryx's `Icon` takes; the build registers them
// with the app's icons, as `uraeda:scissors`, `uraeda:lock`, `uraeda:user`, and `uraeda:git-merge`.
import type { SVGProps } from "react";

function Outline({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden
      fill="none"
      height="1em"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      width="1em"
      {...props}
    >
      {children}
    </svg>
  );
}

/** Lucide's `scissors`: a clean session starts here. */
export function Scissors(props: SVGProps<SVGSVGElement>) {
  return (
    <Outline {...props}>
      <circle cx="6" cy="6" r="3" />
      <path d="M8.12 8.12 12 12" />
      <path d="M20 4 8.12 15.88" />
      <circle cx="6" cy="18" r="3" />
      <path d="M14.8 14.8 20 20" />
    </Outline>
  );
}

/** Lucide's `lock`: the cut cannot be taken away, as the two steps run on different models. */
export function Lock(props: SVGProps<SVGSVGElement>) {
  return (
    <Outline {...props}>
      <rect height="11" rx="0" width="18" x="3" y="11" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </Outline>
  );
}

/** Lucide's `user`: a gate, where the workflow waits for the human. */
export function User(props: SVGProps<SVGSVGElement>) {
  return (
    <Outline {...props}>
      <circle cx="12" cy="7" r="4" />
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    </Outline>
  );
}

/** Lucide's `git-merge`: the map's end, the branch merged. */
export function GitMerge(props: SVGProps<SVGSVGElement>) {
  return (
    <Outline {...props}>
      <circle cx="18" cy="18" r="3" />
      <circle cx="6" cy="6" r="3" />
      <path d="M6 21V9a9 9 0 0 0 9 9" />
    </Outline>
  );
}
