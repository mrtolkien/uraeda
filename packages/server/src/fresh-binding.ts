// Imported first by the Vite configs of the packages that load the native binding: it rebuilds a
// binding older than the Rust core before any of their imports loads it (see `binding.ts`).
import { freshBinding } from "./binding.ts";
import { layout } from "./paths.ts";

freshBinding(layout().checkout);
