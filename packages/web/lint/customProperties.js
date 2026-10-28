// `stylex/custom-property-tokens`: the token limit of `valid-styles`, for the custom properties a
// `stylex.create` sets. `valid-styles` takes any value for a `--*` key, so a raw length or colour
// written into a local custom property and read back with `var()` would pass the limit unchecked.
// Here such a value must be a token too: a `var()`, a calc of them, a keyword of the limit, `0`, or
// a token imported from a `.stylex` file. Its options are the root config's `tokenLimit`.
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const namedColors = require("@stylexjs/eslint-plugin/lib/reference/namedColors.js").default;

/** A number with a unit: a length, a time, or an angle. */
const DIMENSION =
  /(?<![\w-])-?(\d*\.?\d+)(px|r?em|r?lh|r?ex|r?ch|cap|ic|[dsl]?v(?:h|w|i|b|min|max)|cq(?:w|h|i|b|min|max)|cm|mm|q|in|pt|pc|m?s|deg|g?rad|turn)(?![\w-])/gi;

/**
 * Units of the layout, not design values: one line of the element's own text or half of it, and
 * the whole viewport, as a pane's icon is one line tall and the shell's frame the window's height.
 */
const LAYOUT_UNITS = /^((0?\.5|1)lh|100[dsl]?v[hw])$/i;

const COLOUR_FUNCTION = /(?<![\w-])(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\([^)]*\)/i;

const HEX = /#[\da-f]{3,8}(?![\w-])/i;

/** What a value says that is not a token, or `undefined` when it is one. */
function rawPart(text, keywords) {
  const value = text.trim();
  if (keywords.has(value) || /^-?0*\.?0+$/.test(value)) {
    return undefined;
  }
  if (/^-?\d*\.?\d+$/.test(value)) {
    return `the number ${value}`;
  }
  // Names of custom properties and quoted text say nothing of the value's look.
  const bare = value.replaceAll(/--[\w-]+/g, "").replaceAll(/"[^"]*"|'[^']*'/g, "");
  for (const [whole, number] of bare.matchAll(DIMENSION)) {
    if (Number(number) !== 0 && !LAYOUT_UNITS.test(whole)) {
      return `the length ${whole}`;
    }
  }
  const colour = COLOUR_FUNCTION.exec(bare) ?? HEX.exec(bare);
  if (colour) {
    return `the colour ${colour[0]}`;
  }
  const named = bare.match(/(?<![\w-])[a-z]+(?![\w-])/gi)?.find((word) => namedColors.has(word));
  return named ? `the colour ${named}` : undefined;
}

/** The value's text, each expression in it read as a token, or `undefined` for a value not written. */
function valueText(node, constants) {
  if (node.type === "Literal") {
    return typeof node.value === "string" || typeof node.value === "number"
      ? String(node.value)
      : undefined;
  }
  if (node.type === "TemplateLiteral") {
    return node.quasis
      .map((quasi, at) => {
        const expression = node.expressions[at];
        return (
          quasi.value.cooked + (expression ? (expressionText(expression, constants) ?? "") : "")
        );
      })
      .join("");
  }
  return expressionText(node, constants);
}

/** An expression inside a value: a constant's text, or a token for what is read at run time. */
function expressionText(node, constants) {
  if (node.type === "Identifier" && constants.has(node.name)) {
    return valueText(constants.get(node.name), constants);
  }
  return node.type === "Literal" || node.type === "TemplateLiteral"
    ? valueText(node, constants)
    : "var(--token)";
}

/** The name of the custom property a key sets, written or imported, if it sets one. */
function customProperty(property) {
  const { key } = property;
  if (!property.computed) {
    const name = key.type === "Literal" ? key.value : key.name;
    return typeof name === "string" && name.startsWith("--") ? name : undefined;
  }
  // `[paneVars["--pane-end"]]`: a token set for a part of the page.
  const name = key.type === "MemberExpression" ? key.property.value : undefined;
  return typeof name === "string" && name.startsWith("--") ? name : undefined;
}

export default {
  create(context) {
    const options = context.options[0] ?? {};
    const keywords = new Set((options.limit ?? []).filter((value) => typeof value === "string"));
    const constants = new Map();

    /** Reports each custom property of a style object, its conditions and pseudo-elements too. */
    function check(node, name) {
      if (node.type === "ObjectExpression") {
        for (const property of node.properties) {
          if (property.type === "Property") {
            check(property.value, customProperty(property) ?? name);
          }
        }
        return;
      }
      if (node.type === "ArrowFunctionExpression" || node.type === "FunctionExpression") {
        const body = node.body.type === "BlockStatement" ? undefined : node.body;
        return body && check(body, name);
      }
      if (node.type === "ConditionalExpression") {
        check(node.consequent, name);
        return check(node.alternate, name);
      }
      const text = name === undefined ? undefined : valueText(node, constants);
      const raw = text === undefined ? undefined : rawPart(text, keywords);
      if (raw) {
        context.report({
          message: `${name} is set to ${raw}, not a token. ${options.reason ?? ""}`.trim(),
          node,
        });
      }
    }

    return {
      CallExpression(node) {
        const { callee } = node;
        const isCreate =
          callee.type === "MemberExpression" &&
          callee.object.type === "Identifier" &&
          callee.object.name === "stylex" &&
          callee.property.name === "create";
        if (isCreate && node.arguments[0]?.type === "ObjectExpression") {
          for (const style of node.arguments[0].properties) {
            if (style.type === "Property") {
              check(style.value, undefined);
            }
          }
        }
      },
      // The module's constants, which a value may name.
      Program(node) {
        for (const statement of node.body) {
          const declaration =
            statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
          if (declaration?.type === "VariableDeclaration" && declaration.kind === "const") {
            for (const { id, init } of declaration.declarations) {
              if (id.type === "Identifier" && init) {
                constants.set(id.name, init);
              }
            }
          }
        }
      },
    };
  },
  meta: { schema: false, type: "problem" },
};
