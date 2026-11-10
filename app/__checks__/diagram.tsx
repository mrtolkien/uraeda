// A page of `crates/app/tests/outside.rs`: it draws the Mermaid diagram its host names with Pele,
// which runs here, in NSH's VM, and shows the picture its host makes of Pele's SVG.
import { host, Image, mount, signal, View } from "nsh";
import { render } from "pele";

type Picture = { height: number; src: string; width: number };

/** The diagram's picture: it has no address until its host has made it. */
const picture = signal<Picture>({ height: 0, src: "", width: 0 });

function Page() {
  return (
    <View class="flex-1 items-center justify-center bg-white">
      {picture().src ? (
        <Image
          onError={(event) => host.post("failed", event.message)}
          onLoad={() => host.post("shown")}
          src={picture().src}
          style={{ height: picture().height, width: picture().width }}
        />
      ) : null}
    </View>
  );
}

mount(Page);
try {
  const started = Date.now();
  const { height, svg, width } = render(host.params.source as string);
  host.post("drawn", { height, ms: Date.now() - started, width });
  const src = (await host.call("picture", svg)) as string;
  picture.set({ height, src, width });
} catch (error) {
  host.post("failed", String(error));
}
