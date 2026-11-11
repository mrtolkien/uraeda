// Four extensions of the owner's declare their leader keys beside a key of the shell's, as the
// frame does (`../keys.tsx`): Beta's `Space y` is Alpha's already, and Delta's `Space r` the
// shell's. The page draws every key that works, by its scope, and why each extension's keys are
// left out, which `extension.test.tsx` reads.
import { mount, Text, View } from "nsh";
import { declareExtensionKeys, keyProblem } from "../keys";
import { keysOn, registerKey } from "../../../ui/keys";

const nothing = () => undefined;

/** An extension's keys, each under the leader. */
function Extension(props: { name: string; title: string; keys: ReadonlyArray<string> }) {
  declareExtensionKeys(() => ({
    name: props.name,
    specs: props.keys.map((keys) => ({ keys: `space ${keys}`, label: keys, run: nothing })),
    title: props.title,
  }));
  return null;
}

function Page() {
  registerKey({ keys: "space r", label: "Switch repository…", run: nothing });
  return (
    <View style={{ gap: 4, padding: 16 }}>
      <Extension keys={["y"]} name="alpha" title="Alpha" />
      <Extension keys={["z", "y"]} name="beta" title="Beta" />
      <Extension keys={["w"]} name="gamma" title="Gamma" />
      <Extension keys={["r"]} name="delta" title="Delta" />
      <Each of={keysOn().map(({ scope, spec }) => `${scope.name}: ${spec.keys}`)}>
        {(line) => <Text>{line()}</Text>}
      </Each>
      <Each of={["alpha", "beta", "gamma", "delta"]}>
        {(name) => <Text>{`${name()} problem: ${keyProblem(name()) ?? "none"}`}</Text>}
      </Each>
    </View>
  );
}

mount(() => <Page />);
