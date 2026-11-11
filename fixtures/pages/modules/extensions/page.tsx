// A stand-in for `app/extensions/page.tsx`, the page API a page imports as `uraeda/page`.
import { host, mount } from "nsh";

export function place(spec: { name: string; title: string; render: () => unknown }) {
  host.post("navigate", { place: spec.name, title: spec.title });
  mount(spec.render);
}
