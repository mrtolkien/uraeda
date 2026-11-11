// `uraeda/ui`: what an extension's page gets of the component library, built into its package by
// the server (ruling R116). A page draws with the app's own components and tokens, so it looks
// like the app, and follows the app's theme, which `uraeda/page` applies.
//
// The library's whole, but the app's own frame: the layout shell (`./layout`), whose panes and
// stacks are the app's to arrange, and the keys' host (`./keys`), whose bindings are the app's
// window's. A page sits in a pane the app declares for it. Everything exported here imports only
// `nsh`, `nsh/base`, `uraeda/native`, and files of this folder: never the app's store.
export * from "./controls";
export * from "./lists";
export * from "./surfaces";
export * from "./tokens";
export { TextField, type TextFieldProps, type TextFieldRef } from "./text/TextField";
export { isNarrow, width, type WidthClass } from "./width";
