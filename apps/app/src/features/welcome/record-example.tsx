import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Card } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { Heading } from "@/components/ui/heading";
import { requireSupportedLocale } from "@/i18n/locale";
import { formatMinorUnits } from "@/lib/money";

const examples = { sales: "2500", expenses: "800", receivables: "1000" } as const;
type ExampleKind = keyof typeof examples;
const exampleKinds: readonly ExampleKind[] = ["sales", "expenses", "receivables"];

export function RecordExample() {
  const { i18n, t } = useTranslation();
  const [kind, setKind] = useState<ExampleKind>("sales");
  const locale = requireSupportedLocale(i18n.resolvedLanguage);

  return (
    <Card className="gap-6 rounded-lg p-5 sm:p-7">
      <View className="gap-2">
        <Text className="web:font-sans text-xs font-semibold uppercase tracking-[1.2px] text-muted-foreground">
          {t("welcome.preview.label")}
        </Text>
        <Heading level={2} size="section">
          {t("welcome.preview.title")}
        </Heading>
      </View>
      <FilterBar
        label={t("welcome.preview.selector")}
        onChange={setKind}
        options={exampleKinds.map((value) => ({
          value,
          label: t(`operate.modules.${value}.label`),
        }))}
        value={kind}
      />
      <View accessibilityLiveRegion="polite" className="gap-6">
        <View className="gap-2">
          <Text className="web:font-sans text-sm text-muted-foreground">
            {t("welcome.preview.amount")}
          </Text>
          <Text className="web:font-sans text-[38px] font-medium leading-[46px] tracking-[-1px] text-foreground">
            {formatMinorUnits(examples[kind], "USD", 2, locale)}
          </Text>
        </View>
        <View className="gap-4 border-y border-border py-5">
          <View className="gap-1">
            <Text className="web:font-sans text-xs text-muted-foreground">
              {t("welcome.preview.description")}
            </Text>
            <Text className="web:font-sans text-base font-medium text-foreground">
              {t(`welcome.preview.${kind}.description`)}
            </Text>
          </View>
          <View className="gap-1">
            <Text className="web:font-sans text-xs text-muted-foreground">
              {t("welcome.preview.effect")}
            </Text>
            <Text className="web:font-sans text-base leading-6 text-foreground">
              {t(`welcome.preview.${kind}.effect`)}
            </Text>
            <Text className="web:font-sans text-sm leading-5 text-muted-foreground">
              {t(`welcome.preview.${kind}.detail`)}
            </Text>
          </View>
        </View>
      </View>
      <Text className="web:font-sans text-xs leading-5 text-muted-foreground">
        {t("welcome.preview.note")}
      </Text>
    </Card>
  );
}
