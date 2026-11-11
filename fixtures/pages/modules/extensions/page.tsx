// A stand-in for `app/extensions/page.tsx`, the page API a page imports as `uraeda/page`.
import { host, mount } from "nsh";

export function place(spec: { id: string; title: string; icon: string; view: () => unknown }) {
  host.post("navigate", { place: spec.id, title: spec.title });
  mount(spec.view);
}
