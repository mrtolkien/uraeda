// Where the shell draws a place's count: inside its extension's boundary, which the page runtime
// gave the count, so the count's hook reads its extension's records, and a count that throws
// draws `fallback` instead, never the shell's error; and inside a Suspense, while it is read.
import { type ReactNode, Suspense } from "react";

/** Draws a count's element inside its extension's boundary, `fallback` when it fails. */
export type CountBoundary = (children: ReactNode, fallback: ReactNode) => ReactNode;

const boundaries = new WeakMap<() => unknown, CountBoundary>();

/** Gives the count of a place of an extension's page the boundary it is drawn in. */
export function bindCount(count: () => unknown, boundary: CountBoundary) {
  boundaries.set(count, boundary);
}

/** Draws `children`, which call `count` as a hook, in its boundary: `fallback` until read. */
export function CountIn({
  children,
  count,
  fallback,
}: {
  children: ReactNode;
  count: () => unknown;
  fallback: ReactNode;
}) {
  const inBoundary = boundaries.get(count);
  const read = <Suspense fallback={fallback}>{children}</Suspense>;
  return inBoundary ? inBoundary(read, fallback) : read;
}
