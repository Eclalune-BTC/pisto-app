import { ChevronRight } from "lucide-react-native";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";

import type { PaymentFormCopy } from "./types";

type PaymentFormProps = {
  amount: string;
  canReview: boolean;
  copy: PaymentFormCopy;
  date: string;
  errors: Partial<Record<"amount" | "cashAccount" | "date" | "reference" | "time", string>>;
  onCancel: () => void;
  onChange: (field: "amount" | "date" | "reference" | "time", value: string) => void;
  onChooseCashAccount: () => void;
  onReview: () => void;
  reference: string;
  selectedCashAccountName: string | null;
  time: string;
};

export function PaymentForm({
  amount,
  canReview,
  copy,
  date,
  errors,
  onCancel,
  onChange,
  onChooseCashAccount,
  onReview,
  reference,
  selectedCashAccountName,
  time,
}: PaymentFormProps) {
  return (
    <View className="gap-5">
      <Field
        error={errors.amount}
        keyboardType="decimal-pad"
        label={copy.amount}
        onChangeText={(value) => onChange("amount", value)}
        placeholder={copy.amountPlaceholder}
        value={amount}
      />
      <View className="gap-2">
        <Text className="text-sm font-ui text-foreground ">{copy.cashAccount}</Text>
        <Button
          accessibilityLabel={copy.chooseCashAccount}
          className={`min-h-14 flex-row items-center justify-between gap-3 rounded-md border bg-background px-4 active:opacity-75 ${
            errors.cashAccount ? "border-destructive" : "border-border "
          }`}
          onPress={onChooseCashAccount}
          variant="ghost"
        >
          <Text className="min-w-0 flex-1 text-base text-foreground">
            {selectedCashAccountName ?? copy.chooseCashAccount}
          </Text>
          <Icon as={ChevronRight} className="text-muted-foreground" size={18} />
        </Button>
        {errors.cashAccount ? (
          <Text accessibilityRole="alert" className="text-xs text-destructive">
            {errors.cashAccount}
          </Text>
        ) : null}
      </View>
      <View className="gap-5 sm:flex-row">
        <View className="min-w-0 flex-1">
          <Field
            error={errors.date}
            label={copy.date}
            onChangeText={(value) => onChange("date", value)}
            placeholder={copy.datePlaceholder}
            value={date}
          />
        </View>
        <View className="min-w-0 flex-1">
          <Field
            error={errors.time}
            label={copy.time}
            onChangeText={(value) => onChange("time", value)}
            placeholder={copy.timePlaceholder}
            value={time}
          />
        </View>
      </View>
      <Field
        error={errors.reference}
        label={`${copy.reference} (${copy.optional})`}
        onChangeText={(value) => onChange("reference", value)}
        placeholder={copy.referencePlaceholder}
        value={reference}
      />
      <View className="gap-3 sm:flex-row sm:justify-end">
        <Button label={copy.cancel} onPress={onCancel} variant="ghost" />
        <Button disabled={!canReview} label={copy.review} onPress={onReview} variant="default" />
      </View>
    </View>
  );
}
