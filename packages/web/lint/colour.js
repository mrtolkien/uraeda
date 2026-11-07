// `colour/roles-not-hues`: the Colour themes decision's "a view MUST ask for a colour by its role,
// never by a hue". A theme maps its own palette onto roles, so a view that names one of Astryx's
// hue tokens, `--color-text-orange`, draws whatever the theme's orange is, not what the view means.
// Refused: a hue token in a string or a template's text, a member key such as
// `colorVars["--color-border-red"]` included, and a component's `variant` or `color` set to a hue,
// written or picked by a condition, as `<Badge variant="yellow" />`. Views write
// `var(--role-<role>)` instead (`src/theme/roles.ts`), or a semantic token, `--color-success`.

const HUES = "red|orange|yellow|green|teal|cyan|blue|purple|pink|gray|lavender|sapphire";
const HUE_TOKEN = new RegExp(`--color-(text|border|background|icon|fill)-(${HUES})(?![\\w-])`);
const HUE = new RegExp(`^(${HUES})$`);
const MESSAGE =
  "Ask for a colour by its role, var(--role-…), never a hue (Colour themes decision).";

/** The strings an attribute's value may take: a literal, a plain template, or a condition's. */
function textsOf(node) {
  if (!node) {
    return [];
  }
  switch (node.type) {
    case "Literal":
      return typeof node.value === "string" ? [node.value] : [];
    case "TemplateLiteral":
      return node.expressions.length === 0 ? [node.quasis[0]?.value.cooked ?? ""] : [];
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
    const check = (node, text) => {
      const hue = typeof text === "string" ? HUE_TOKEN.exec(text) : null;
      if (hue) {
        context.report({ message: `${MESSAGE} Found ${hue[0]}.`, node });
      }
    };
    return {
      JSXAttribute(node) {
        const name = node.name.type === "JSXIdentifier" ? node.name.name : undefined;
        if (name !== "variant" && name !== "color") {
          return;
        }
        for (const text of textsOf(node.value)) {
          if (HUE.test(text)) {
            context.report({ message: `${MESSAGE} Found ${name}="${text}".`, node });
          }
        }
      },
      Literal(node) {
        check(node, node.value);
      },
      TemplateElement(node) {
        check(node, node.value.cooked);
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
