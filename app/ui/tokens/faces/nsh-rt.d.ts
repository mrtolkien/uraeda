// What a font's import compiles to, from Native Shell's runtime module, which declares nothing for
// an app: `font(uri, family)` registers the font file `uri` and gives `family`. NSH's bundler writes
// it for `import Inter from "./Inter.ttf"`; the faces of the app's crate are not files of the app's
// own, so their chunks call it themselves (ruling T60.2).
declare module "nsh:rt" {
  export function font(uri: string, family: string): string;
}
