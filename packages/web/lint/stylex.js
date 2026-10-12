// StyleX's lint rules, for oxlint's JavaScript plugins. `valid-styles` takes its `propLimits` from
// the root `vite.config.ts`, where a limit can also name two kinds of values that the plugin's own
// options cannot: "var(--*)", a CSS variable, as the theme's tokens are, and "<percentage>".
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { rules } = require("@stylexjs/eslint-plugin");
const isCSSVariable = require("@stylexjs/eslint-plugin/lib/rules/isCSSVariable.js").default;
const isPercentage = require("@stylexjs/eslint-plugin/lib/rules/isPercentage.js").default;

const named = { "var(--*)": isCSSVariable, "<percentage>": isPercentage };

/** The options with each named kind of value replaced by the plugin's rule for it. */
function withNamedLimits(options) {
  const propLimits = {};
  for (const [prop, { limit, reason }] of Object.entries(options?.propLimits ?? {})) {
    propLimits[prop] = {
      reason,
      limit: Array.isArray(limit) ? limit.map((value) => named[value] ?? value) : limit,
    };
  }
  return { ...options, propLimits };
}

const validStyles = {
  ...rules["valid-styles"],
  meta: { ...rules["valid-styles"].meta, schema: false },
  create(context) {
    const options = [withNamedLimits(context.options[0])];
    return rules["valid-styles"].create(Object.create(context, { options: { value: options } }));
  },
};

export default { meta: { name: "stylex" }, rules: { ...rules, "valid-styles": validStyles } };
