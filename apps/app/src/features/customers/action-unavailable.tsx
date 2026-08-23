import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Page } from "@/components/page";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";

import { buildCustomersCopy } from "./copy";

type ActionUnavailableProps = {
  description: string;
  onBack: () => void;
  title: string;
};

export function ActionUnavailable({ description, onBack, title }: ActionUnavailableProps) {
  const { t } = useTranslation();
  const copy = useMemo(() => buildCustomersCopy(t), [t]);
  return (
    <Page width="form">
      <Button label={copy.common.back} onPress={onBack} variant="ghost" />
      <ScreenHeader description={description} title={title} />
      <View className="border-y border-line py-5 dark:border-[#304239]">
        <Text className="text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">{description}</Text>
      </View>
    </Page>
  );
}
