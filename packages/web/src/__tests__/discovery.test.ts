import { expect, test } from "vite-plus/test";
import { discoveryOf, withDiscovery } from "../discovery.ts";

test("a proposal without the field asks for high", () => {
  expect(discoveryOf("# X\n")).toBe("high");
  expect(discoveryOf("---\nother: 1\n---\n# X\n")).toBe("high");
  expect(discoveryOf("---\ndiscovery: deep\n---\n# X\n")).toBe("high");
});

test("the field is read with quotes and comments", () => {
  expect(discoveryOf("---\ndiscovery: low # a comment\n---\n# X\n")).toBe("low");
  expect(discoveryOf('---\ndiscovery: "medium"\n---\n# X\n')).toBe("medium");
});

test("a text without frontmatter gets one", () => {
  expect(withDiscovery("# X\n", "low")).toBe("---\ndiscovery: low\n---\n\n# X\n");
});

test("the field's line is replaced, its comment kept", () => {
  expect(withDiscovery("---\ndiscovery: high # how far\n---\n\n# X\n", "medium")).toBe(
    "---\ndiscovery: medium # how far\n---\n\n# X\n",
  );
});

test("the field is added to an existing frontmatter", () => {
  expect(withDiscovery("---\nother: 1\n---\n# X\n", "low")).toBe(
    "---\nother: 1\ndiscovery: low\n---\n# X\n",
  );
  expect(withDiscovery("---\n---\n# X\n", "low")).toBe("---\ndiscovery: low\n---\n# X\n");
});
