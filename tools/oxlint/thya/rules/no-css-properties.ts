import { defineRule } from "@oxlint/plugins";

/** Ban React's `CSSProperties` type: styling in apps/web goes through Tailwind tokens, not style objects. */
export const noCssPropertiesRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow the `CSSProperties` type; style with Tailwind classes from the theme tokens.",
    },
    messages: {
      cssProperties:
        "`CSSProperties` means a style object. Use Tailwind classes from the @theme tokens, data-*/aria-* variants for state, or motion props for animation. See docs/landing-styling.md.",
    },
  },
  createOnce(context) {
    return {
      ImportSpecifier(node) {
        if (node.imported.type === "Identifier" && node.imported.name === "CSSProperties") {
          context.report({ node, messageId: "cssProperties" });
        }
      },
      TSQualifiedName(node) {
        if (node.right.name === "CSSProperties") {
          context.report({ node, messageId: "cssProperties" });
        }
      },
    };
  },
});
