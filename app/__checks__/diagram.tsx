// A page of `crates/app/tests/outside.rs`: it shows the picture its host makes of the Mermaid
// diagram it names. The host draws it in Rust, with Merman: no JavaScript draws a diagram.
import { host, Image, mount, signal, View } from "nsh";

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
  const drawn = (await host.call("picture", host.params.source as string)) as Picture;
  host.post("drawn", { height: drawn.height, width: drawn.width });
  picture.set(drawn);
} catch (error) {
  host.post("failed", String(error));
}
