// The owner's extensions' keys: each extension's place keys and `key`s are declared in a scope of
// its own, named by its title, all of them or none. The key registry throws when a key would mean
// two things: that throw is caught here, per extension, which is named, its keys left out, and the
// others keep theirs. A built-in's keys are the shell's, declared first and kept for it even while
// it is off (`../shell/keys.tsx`), so no extension of the owner's takes one.
//
// A key of a page runs in the page: the app keeps one view of the page, unseen, from its first
// press, and sends it `key`, which runs the `run` the page gave (`app/extensions/page.tsx`).
import { type Accessor, effect, signal, untracked, View } from "nsh";
import { ExtensionPlace } from "../../extensions/ExtensionPlace";
import { type KeysOf, keysOf, leaderKeys, placesOf } from "../../extensions/contributions";
import { extensionHost, navigate } from "../../store";
import type { ExtensionRow } from "../../store/protocol";
import { type KeySpec, keyScope, registerKey } from "../../ui/keys";
import { refusalOf } from "../../ui/controls";

/** Why an extension's keys are left out, by its name: the registry's words. */
const problems = signal<ReadonlyMap<string, string>>(new Map());

/** Why the keys of `name` are left out, if they are. */
export const keyProblem = (name: string) => problems().get(name);

function said(name: string, problem: string | undefined) {
  const next = new Map(untracked(problems));
  if (problem === undefined) next.delete(name);
  else next.set(name, problem);
  problems.set(next);
}

/** An extension's keys, as one declaration. */
export type ExtensionKeySpecs = { name: string; title: string; specs: ReadonlyArray<KeySpec> };

/**
 * Declares an extension's keys in a scope of its own, while the caller is mounted: a key that would
 * mean two things leaves all of them out, and says why under its name. Called in a component.
 */
export function declareExtensionKeys(keys: Accessor<ExtensionKeySpecs>) {
  const scope = keyScope({ name: untracked(keys).title });
  effect(() => {
    const { name, specs } = keys();
    try {
      registerKey(specs, scope);
      untracked(() => said(name, undefined));
    } catch (error) {
      untracked(() => said(name, refusalOf(error)));
    }
  });
  effect(() => {
    const name = keys().name;
    return () => untracked(() => said(name, undefined));
  });
}

/** The keys pressed for each page, the last one by its number, which the page's view sends. */
const pressed = signal<ReadonlyMap<string, { keys: string; n: number }>>(new Map());
let presses = 0;

function press(name: string, keys: string) {
  const next = new Map(untracked(pressed));
  next.set(name, { keys, n: ++presses });
  pressed.set(next);
}

/** The keys of one extension of the owner's: its places' and its page's. */
function OwnerKeys(props: { name: string; repo: string; title: string }) {
  declareExtensionKeys(() => {
    const places = placesOf(props.repo).flatMap((one) =>
      one.kind === "owner" && one.extension === props.name && one.key !== undefined
        ? [
            {
              icon: "plug",
              keys: `space ${one.key}`,
              label: one.title,
              run: () => navigate({ name: one.extension, page: "extension", rest: one.id }),
            },
          ]
        : [],
    );
    const sent = keysOf(props.repo).find((one) => one.extension === props.name)?.sent ?? [];
    return {
      name: props.name,
      specs: [
        ...places,
        ...sent.map((key) => ({
          icon: key.icon ?? "plug",
          keys: leaderKeys(key.keys),
          label: key.label,
          run: () => press(props.name, key.keys),
        })),
      ],
      title: props.title,
    };
  });
  return null;
}

/** The page of an extension whose key was pressed, unseen, which runs its keys. */
function Runner(props: { name: string; repo: string; row: ExtensionRow }) {
  const host = extensionHost();
  return (
    <View style={{ height: 0, overflow: "hidden", width: 0 }}>
      <ExtensionPlace
        extension={() => props.row}
        host={host}
        pressed={() => pressed().get(props.name)}
        repo={props.repo}
      />
    </View>
  );
}

/** The owner's extensions' keys in `repo`, and the pages that run them. */
export function ExtensionKeys(props: { repo: string }) {
  const owners = () => keysOf(props.repo).filter((one) => one.row !== undefined);
  const running = () => owners().filter((one) => pressed().has(one.extension));
  return (
    <>
      <Each key={(one: KeysOf) => one.extension} of={owners()}>
        {(one) => <OwnerKeys name={one().extension} repo={props.repo} title={one().title} />}
      </Each>
      <Each key={(one: KeysOf) => one.extension} of={running()}>
        {(one) => <Runner name={one().extension} repo={props.repo} row={one().row!} />}
      </Each>
    </>
  );
}
