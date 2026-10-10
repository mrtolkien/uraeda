export default {
  staged: {
    "*.rs": "rustfmt",
    "!(*.rs)": "vp check --fix",
  },
  lint: {
    ignorePatterns: [
      "fixtures/**",
      "packages/binding/index.js",
      "packages/binding/index.d.ts",
      "packages/web/.fate/**",
    ],
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
  test: {
    // Each package runs with its own Vite config: the UI's needs React, fate, and happy-dom.
    projects: ["packages/*"],
  },
  fmt: {
    ignorePatterns: [
      "fixtures/**",
      "packages/binding/index.js",
      "packages/binding/index.d.ts",
      "packages/web/.fate/**",
    ],
    proseWrap: "always",
  },
};
