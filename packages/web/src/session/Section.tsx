// A part of the session's column with a read of its own: while it loads, nothing; once its read
// fails, nothing either, or what stands for it, so the session and the column's other parts go on.
import { Component, type ReactNode, Suspense } from "react";

/**
 * A part of the column whose read failed: left out, or drawn as `failed`, so the session and the
 * other parts go on. The read is tried again with the page.
 */
export class Section extends Component<
  { children: ReactNode; failed?: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? (
      (this.props.failed ?? null)
    ) : (
      <Suspense fallback={null}>{this.props.children}</Suspense>
    );
  }
}
