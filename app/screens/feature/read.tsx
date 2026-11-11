// What every pane of the feature page shares: its arguments, the clock that counts a running time,
// and the states before the feature is there, each in words.
import { cleanup, type JSX, signal } from "nsh";
import { navigate, record } from "../../store";
import type { Feature } from "../../store/protocol";
import { Banner, Spinner } from "../../ui/controls";
import { Empty } from "../../ui/lists";

/** A pane of the feature page: the repository and the feature's folder. */
export type FeatureArgs = { folder: string; repo: string };

/** The clock, read again every `every` ms while the caller is drawn: what counts a running time. */
export function ticking(every: number) {
  const now = signal(Date.now());
  const timer = setInterval(() => now.set(Date.now()), every);
  cleanup(() => clearInterval(timer));
  return now;
}

/** The feature, read live: `undefined` until it came, `null` when no feature has the folder. */
export const featureOf = (args: FeatureArgs) =>
  record("Feature", { id: args.folder, repo: args.repo });

/**
 * Draws `children` with the feature once it is read; until then, why not: reading, refused, or no
 * such feature, with the way home.
 */
export function WithFeature(props: {
  args: FeatureArgs;
  children: (feature: () => Feature) => JSX.Element;
}) {
  const feature = featureOf(props.args);
  return (
    <If
      when={feature.error()}
      else={
        <If when={feature() !== undefined} else={<Spinner label="Reading the feature" />}>
          <If
            when={feature()}
            else={
              <Empty
                action={{ icon: "house", label: "Home", run: () => navigate({ page: "home" }) }}
                icon="flag"
                title={`No feature ${props.args.folder}`}
                words="No branch, worktree, or folder of this repository holds it: it was dropped, cleaned after its merge, or the address was typed by hand."
              />
            }
          >
            {(shown) => props.children(shown)}
          </If>
        </If>
      }
    >
      {(error) => (
        <Banner title="The feature could not be read" tone="danger">
          {error().message}
        </Banner>
      )}
    </If>
  );
}
