// `colour/roles-not-hues`: the Colour themes decision's "a view MUST ask for a colour by its role,
// never by a hue". A theme maps its own palette onto roles, so a view that names one of Astryx's
// hue tokens, `--color-text-orange`, draws whatever the theme's orange is, not what the view means.
// Refused: a hue token in a string or a template's text, a member key such as
// `colorVars["--color-border-red"]` included; a hue token built from a template, its hue an
// expression, `--color-text-${hue}`; a component's `variant` or `color` set to a hue, written or
// picked by a condition, as `<Badge variant="yellow" />`, or as an object's property passed on,
// `{ variant: "red" }`; and a string that is a hue's name alone, `"purple"`, which only a hue
// variant or token reads. Views write `var(--role-<role>)` instead (`src/theme/roles.ts`), or a
// semantic token, `--color-success`.

const HUES = "red|orange|yellow|green|teal|cyan|blue|purple|pink|gray|lavender|sapphire";
const HUE_TOKEN = new RegExp(`--color-(text|border|background|icon|fill)-(${HUES})(?![\\w-])`);
const HUE = new RegExp(`^(${HUES})$`);
/** A template's text that a hue, its expression, completes into a hue token. */
const HUE_PREFIX = /--color-(text|border|background|icon|fill)-$/;
const MESSAGE =
  "Ask for a colour by its role, var(--role-…), never a hue (Colour themes decision).";

/**
 * The strings a value may take, each with its node: a literal, a plain template, or a condition's.
 */
function textsOf(node) {
  if (!node) {
    return [];
  }
  switch (node.type) {
    case "Literal":
      return typeof node.value === "string" ? [[node, node.value]] : [];
    case "TemplateLiteral":
      return node.expressions.length === 0 ? [[node, node.quasis[0]?.value.cooked ?? ""]] : [];
    case "JSXExpressionContainer":
      return textsOf(node.expression);
    case "ConditionalExpression":
      return [...textsOf(node.consequent), ...textsOf(node.alternate)];
    case "LogicalExpression":
      return [...textsOf(node.left), ...textsOf(node.right)];
    default:
      return [];
  }
}

const rolesNotHues = {
  create(context) {
    // One report per node: a hue in a prop is also a string that is a hue's name.
    const reported = new WeakSet();
    const report = (node, found) => {
      if (!reported.has(node)) {
        reported.add(node);
        context.report({ message: `${MESSAGE} Found ${found}.`, node });
      }
    };
    const check = (node, text) => {
      const hue = typeof text === "string" ? HUE_TOKEN.exec(text) : null;
      if (hue) {
        report(node, hue[0]);
      }
    };
    // A `variant` or `color` given a hue, as a JSX attribute's value or an object's property.
    const checkProp = (name, value) => {
      if (name !== "variant" && name !== "color") {
        return;
      }
      for (const [node, text] of textsOf(value)) {
        if (HUE.test(text)) {
          report(node, `${name}="${text}"`);
        }
      }
    };
    return {
      JSXAttribute(node) {
        checkProp(node.name.type === "JSXIdentifier" ? node.name.name : undefined, node.value);
      },
      Literal(node) {
        check(node, node.value);
        if (typeof node.value === "string" && HUE.test(node.value)) {
          report(node, `"${node.value}"`);
        }
      },
      Property(node) {
        const key = node.key.type === "Identifier" ? node.key.name : node.key.value;
        checkProp(node.computed ? undefined : key, node.value);
      },
      TemplateElement(node) {
        check(node, node.value.cooked);
        if (!node.tail && HUE_PREFIX.test(node.value.cooked ?? "")) {
          report(node, `${node.value.cooked}\${…}`);
        }
      },
    };
  },
  meta: {
    docs: { description: "Ask for a colour by its role, never by a hue." },
    type: "problem",
  },
};

export default {
  meta: { name: "colour" },
  rules: { "roles-not-hues": rolesNotHues },
};
