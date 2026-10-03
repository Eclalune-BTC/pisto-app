import ts from "typescript";
import { describe, expect, test } from "vitest";

const sources = import.meta.glob("../**/*.tsx", {
  eager: true,
  import: "default",
  query: "?raw",
}) as Record<string, string>;

describe("shared component boundaries", () => {
  test("keeps native inputs and action buttons inside the shared UI implementation", () => {
    const violations: string[] = [];
    for (const [path, source] of Object.entries(sources)) {
      if (/\.test\./.test(path)) continue;
      if (path.startsWith("./ui/") || path.includes("/components/ui/")) continue;
      const tree = ts.createSourceFile(
        path,
        source,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );
      const nativeNames = new Map<string, string>();
      for (const statement of tree.statements) {
        if (
          !ts.isImportDeclaration(statement) ||
          !ts.isStringLiteral(statement.moduleSpecifier) ||
          statement.moduleSpecifier.text !== "react-native"
        )
          continue;
        const bindings = statement.importClause?.namedBindings;
        if (bindings && ts.isNamedImports(bindings)) {
          for (const binding of bindings.elements)
            nativeNames.set(binding.name.text, (binding.propertyName ?? binding.name).text);
        }
      }
      function visit(node: ts.Node) {
        if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
          const tag = node.tagName.getText(tree);
          const native = nativeNames.get(tag);
          const invalid =
            ["button", "input", "textarea", "select"].includes(tag) ||
            (native !== undefined &&
              [
                "Button",
                "ActivityIndicator",
                "Pressable",
                "Switch",
                "TextInput",
                "TouchableOpacity",
                "TouchableHighlight",
                "TouchableWithoutFeedback",
              ].includes(native));
          if (invalid)
            violations.push(
              `${path}:${tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1} ${tag}`,
            );
        }
        ts.forEachChild(node, visit);
      }
      visit(tree);
    }
    expect(violations).toEqual([]);
  });

  test("uses the RNR Text and installed controls outside their implementation boundary", () => {
    const violations: string[] = [];
    for (const [path, source] of Object.entries(sources)) {
      if (/\.test\./.test(path) || path.includes("/components/ui/") || path.startsWith("./ui/"))
        continue;
      const tree = ts.createSourceFile(
        path,
        source,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );
      for (const statement of tree.statements) {
        if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier))
          continue;
        const module = statement.moduleSpecifier.text;
        const startup = path.endsWith("/app/_layout.tsx");
        if (
          module.startsWith("@rn-primitives/") &&
          !(startup && module === "@rn-primitives/portal")
        )
          violations.push(path);
        const bindings = statement.importClause?.namedBindings;
        if (module === "react-native" && !startup && bindings && ts.isNamedImports(bindings)) {
          for (const binding of bindings.elements) {
            if ((binding.propertyName ?? binding.name).text === "Text")
              violations.push(`${path}: Text`);
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });

  test("does not replace missing query identity with a fictitious record", () => {
    const violations = Object.entries(sources)
      .filter(([, source]) =>
        /"(?:unselected|inactive-business|missing-customer|missing-account|missing-receivable|0000-00-00|00000000-0000-4000-8000-000000000000)"/.test(
          source,
        ),
      )
      .map(([path]) => path);
    expect(violations).toEqual([]);
  });
});
