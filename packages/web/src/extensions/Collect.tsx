// What gathers a value from each of a list of contributions whose value is read by a component of
// its own, with its hooks, as home's panes and the New page's sections are: each one's component
// hands its value to the next level, and the last level hands them all to `children`, so that one
// list draws them together, its keys moving across them.
import type { ReactNode } from "react";

export function Collect<T, V>({
  children,
  done = [],
  items,
  read,
}: {
  children: (values: ReadonlyArray<V>) => ReactNode;
  /** The values gathered so far, by the levels above. */
  done?: ReadonlyArray<V>;
  items: ReadonlyArray<T>;
  /** Draws what reads `item`'s value, handing it to `next`. */
  read: (item: T, next: (value: V) => ReactNode) => ReactNode;
}) {
  if (items.length === 0) {
    return children(done);
  }
  const [first, ...rest] = items;
  return read(first, (value) => (
    <Collect done={[...done, value]} items={rest} read={read}>
      {children}
    </Collect>
  ));
}
