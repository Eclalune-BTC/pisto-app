import { ArrowLeft, LockKeyhole } from "lucide-react-native";
import { Text, View } from "react-native";

import { Page } from "@/components/page";
import { ScreenHeader } from "@/components/screen-header";
import { Button, ButtonText } from "@/components/ui/button";
import { customersReceivablesCopy as copy } from "@/features/customers/copy";

export function PaymentCapabilityBoundary({ onBack }: { onBack: () => void }) {
  return (
    <Page width="form">
      <Button className="self-start px-0" onPress={onBack} variant="ghost">
        <ArrowLeft color="#237A55" size={18} />
        <ButtonText variant="ghost">{copy.common.back}</ButtonText>
      </Button>
      <ScreenHeader
        description={copy.receivables.list.paymentsUnavailableDescription}
        title={copy.receivables.list.paymentsUnavailableTitle}
      />
      <View className="flex-row items-start gap-3 border-y border-line py-5 dark:border-[#304239]">
        <LockKeyhole color="#617168" size={21} />
        <Text className="min-w-0 flex-1 text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
          {copy.receivables.list.paymentsUnavailableDescription}
        </Text>
      </View>
    </Page>
  );
}
