import { defineRule } from "@oxlint/plugins";

const classFragmentEnd = /[-[:/]$/;

/** Ban class names assembled from runtime values, such as `bg-${tone}`: Tailwind only generates classes written out in full. */
export const noDynamicClassFragmentsRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow className template literals that build part of a class name from an expression.",
    },
    messages: {
      dynamicFragment:
        "Tailwind cannot see a class built from `${...}`, so no CSS is generated. Pick a full class from a static map, or put the state in data-*/aria-* and use a variant such as `data-[active=true]:bg-brand`.",
    },
  },
  createOnce(context) {
    return {
      JSXAttribute(node) {
        if (node.name.type !== "JSXIdentifier" || node.name.name !== "className") return;

        if (node.value?.type !== "JSXExpressionContainer") return;

        const template = node.value.expression;

        if (template.type !== "TemplateLiteral") return;

        const glued = template.quasis.some(
          (quasi, index) =>
            (index < template.expressions.length && classFragmentEnd.test(quasi.value.raw)) ||
            (index > 0 && /^[\w[\]-]/.test(quasi.value.raw)),
        );

        if (glued) {
          context.report({ node, messageId: "dynamicFragment" });
        }
      },
    };
  },
});
