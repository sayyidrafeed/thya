import { eslintCompatPlugin } from "@oxlint/plugins";

import { noCssPropertiesRule } from "./rules/no-css-properties.ts";
import { noDynamicClassFragmentsRule } from "./rules/no-dynamic-class-fragments.ts";

/** Thya's own lint rules. Vendored upstream rules live in ../anti-slop. */
const thyaPlugin = eslintCompatPlugin({
  meta: { name: "thya" },
  rules: {
    "no-css-properties": noCssPropertiesRule,
    "no-dynamic-class-fragments": noDynamicClassFragmentsRule,
  },
});

export default thyaPlugin;
