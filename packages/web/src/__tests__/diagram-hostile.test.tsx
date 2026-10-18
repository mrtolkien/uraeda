// The diagrams decision's rule: a diagram draws without a script, an event handler, or a
// `javascript:` link in the page, even when its text holds them.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vite-plus/test";
import { Diagram } from "../Diagram.tsx";

afterEach(cleanup);

const HOSTILE = [
  'flowchart LR\n a["<img src=x onerror=alert(1)>"] --> b',
  'flowchart LR\n a[x] --> b\n click a "javascript:alert(1)"\n click b call alert(1)',
  "sequenceDiagram\n A->>B: <script>alert(1)</script> <b onmouseover=alert(1)>hi</b>",
  'flowchart LR\n a["x<foreignObject><body onload=alert(1)>"] --> b',
];

test.each(HOSTILE)(
  "a hostile diagram draws without script, handler, or javascript link: %s",
  async (source) => {
    const { container } = render(<Diagram source={source} />);
    await screen.findByRole("group", { name: /diagram$/ }, { timeout: 10_000 });
    expect(container.querySelector("svg")).not.toBeNull();
    expect(container.querySelector("script, foreignObject")).toBeNull();
    for (const element of container.querySelectorAll("*")) {
      expect(element.getAttributeNames().filter((name) => name.startsWith("on"))).toEqual([]);
      expect(element.getAttribute("href") ?? "").not.toMatch(/^\s*javascript:/i);
    }
  },
);
