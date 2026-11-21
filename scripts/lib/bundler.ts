import path from "node:path";
import type { BundlerOverrideFn } from "@remotion/bundler";
import { enableTailwind } from "@remotion/tailwind-v4";

export function createBundleOverride(root: string): BundlerOverrideFn {
  const typographyDir = path.join(root, "src", "typography");
  return (config) => {
    const configured = enableTailwind(config);
    return {
      ...configured,
      module: {
        ...configured.module,
        rules: [
          ...(configured.module?.rules ?? []),
          {
            // KineticText is protected. Redirect its legacy import only.
            include: path.join(typographyDir, "KineticText.tsx"),
            resolve: { alias: { "./fonts$": path.join(typographyDir, "localFonts.ts") } },
          },
        ],
      },
    };
  };
}
