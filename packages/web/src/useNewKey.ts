// `a` on Home and on the Sessions page: add the page's main kind of item, a new session, change, or
// feature, which is the New page. The same page the New button opens, declared in the key registry
// by the page that has no other use for the key.
import { useKeys } from "./keys/registry.tsx";
import { navigateHere } from "./routes.tsx";

/** Declares `a` to open the New page, while the caller is mounted and `isOn`. */
export function useNewKey(isOn = true) {
  useKeys(
    isOn ? [{ icon: "uraeda:plus", keys: "a", label: "New", run: () => navigateHere("/new") }] : [],
  );
}
