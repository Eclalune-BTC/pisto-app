import { fileURLToPath } from "node:url";
import { transformWithOxc } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    {
      name: "rn-primitives-jsx",
      enforce: "pre",
      transform(code, id) {
        if (!id.includes("/@rn-primitives/") || !/\.m?js$/.test(id)) return;
        return transformWithOxc(code, id, { lang: "jsx", jsx: { runtime: "automatic" } });
      },
    },
  ],
  oxc: { jsx: { runtime: "automatic" } },
  resolve: {
    alias: [
      {
        find: /^expo-router$/,
        replacement: fileURLToPath(new URL("./test-support/expo-router.tsx", import.meta.url)),
      },
      {
        find: /^expo-router\/head$/,
        replacement: fileURLToPath(new URL("./test-support/expo-router-head.tsx", import.meta.url)),
      },
      ...Object.entries({
        "@": fileURLToPath(new URL("./src", import.meta.url)),
        ...Object.fromEntries(
          [
            "checkbox",
            "dialog",
            "label",
            "radio-group",
            "separator",
            "switch",
            "toggle",
            "toggle-group",
            "tooltip",
            "dropdown-menu",
            "alert-dialog",
            "popover",
            "collapsible",
            "progress",
          ].map((name) => [
            `@rn-primitives/${name}`,
            fileURLToPath(
              new URL(
                `../../node_modules/@rn-primitives/${name}/dist/${name}.web.mjs`,
                import.meta.url,
              ),
            ),
          ]),
        ),
        "react-native-reanimated": fileURLToPath(
          new URL("./test-support/reanimated.tsx", import.meta.url),
        ),
        "react-native-screens": fileURLToPath(
          new URL("./test-support/screens.tsx", import.meta.url),
        ),
        "react-native-svg": fileURLToPath(new URL("./test-support/svg.tsx", import.meta.url)),
        "@rn-primitives/accordion": fileURLToPath(
          new URL(
            "../../node_modules/@rn-primitives/accordion/dist/accordion.web.mjs",
            import.meta.url,
          ),
        ),
        "@rn-primitives/select": fileURLToPath(
          new URL("../../node_modules/@rn-primitives/select/dist/select.web.mjs", import.meta.url),
        ),
        "@rn-primitives/tabs": fileURLToPath(
          new URL("../../node_modules/@rn-primitives/tabs/dist/tabs.web.mjs", import.meta.url),
        ),
        "@pisto/contracts": fileURLToPath(
          new URL("../../packages/contracts/src/index.ts", import.meta.url),
        ),
      }).map(([find, replacement]) => ({ find, replacement })),
    ],
  },
  test: {
    server: { deps: { inline: [/@rn-primitives\//, /lucide-react-native/] } },
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
