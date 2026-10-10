export default {
  staged: {
    "*.rs": "rustfmt",
    "!(*.rs)": "vp check --fix",
  },
  lint: {
    ignorePatterns: ["fixtures/**", "packages/binding/index.js", "packages/binding/index.d.ts"],
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
  fmt: {
    ignorePatterns: ["fixtures/**", "packages/binding/index.js", "packages/binding/index.d.ts"],
    proseWrap: "always",
  },
};
