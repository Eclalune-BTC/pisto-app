import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Page } from "@/components/page";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

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
      <View className="border-y border-border py-5 ">
        <Text className="text-sm leading-5 text-muted-foreground">{description}</Text>
      </View>
    </Page>
  );
}
