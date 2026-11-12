// The bundled fonts' files in a browser, fetched as a device shows them (ruling R471). On a
// machine Native Shell registers every font of the app's crate before the first frame. A browser
// would fetch all of them, 2.4 MB, before its first frame: there the engine registers only
// Monaspace Neon's regular face as the app starts (`crates/app/src/fonts.rs`), and each family
// comes in a chunk of its own, `faces/<id>.web.ts`, which Native Shell's page fetches with the
// fonts it names once a device shows the family. Its text is measured again as they come.
import { platform } from "nsh";

const FACES: Readonly<Record<string, () => Promise<unknown>>> = {
  argon: () => import("./faces/argon.web"),
  atkinson: () => import("./faces/atkinson.web"),
  inter: () => import("./faces/inter.web"),
  jetbrains: () => import("./faces/jetbrains.web"),
  krypton: () => import("./faces/krypton.web"),
  literata: () => import("./faces/literata.web"),
  neon: () => import("./faces/neon.web"),
  radon: () => import("./faces/radon.web"),
  xenon: () => import("./faces/xenon.web"),
};

/** The families asked for already, loaded or loading. */
const asked = new Set<string>();

/**
 * Registers the faces of the bundled fonts `ids` in a browser, once each, with Monaspace Neon's,
 * which every family falls back to. On a machine they are all registered already.
 */
export function showFaces(ids: Iterable<string>) {
  if (platform.os !== "web") return;
  for (const id of new Set(["neon", ...ids])) {
    const load = FACES[id];
    if (load === undefined || asked.has(id)) continue;
    asked.add(id);
    load().catch((error: unknown) => {
      asked.delete(id);
      console.warn(`The font ${id} did not load: ${String(error)}`);
    });
  }
}
