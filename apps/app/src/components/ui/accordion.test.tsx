import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("react-native", async () => vi.importActual("react-native-web"));
vi.mock("uniwind", () => ({
  withUniwind: (component: unknown) => component,
  useCSSVariable: (names: string | string[]) =>
    Array.isArray(names) ? names.map(() => "#62626B") : "#62626B",
}));
vi.mock("lucide-react-native", () => ({ AlertTriangle: () => null, ChevronDown: () => null }));

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./accordion.web";
import { Text } from "./text";

function render(value: string) {
  return renderToStaticMarkup(
    <Accordion type="single" value={value} collapsible>
      <AccordionItem value="question">
        <AccordionTrigger>
          <Text>What is included?</Text>
        </AccordionTrigger>
        <AccordionContent>
          <Text>Only the implemented product capabilities.</Text>
        </AccordionContent>
      </AccordionItem>
    </Accordion>,
  );
}

describe("registry-backed accordion", () => {
  test("names a collapsed control and omits its closed answer", () => {
    const markup = render("");
    expect(markup).toContain("What is included?");
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).not.toContain("Only the implemented product capabilities.");
    const identifiers = [...markup.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
    expect(new Set(identifiers).size).toBe(identifiers.length);
  });
  test("announces the open state and exposes the selected content", () => {
    const markup = render("question");
    expect(markup).toContain('aria-expanded="true"');
    expect(markup).toContain("aria-controls=");
    expect(markup).toContain("aria-labelledby=");
    expect(markup).toContain('role="region"');
    expect(markup).toContain("Only the implemented product capabilities.");
  });
});
