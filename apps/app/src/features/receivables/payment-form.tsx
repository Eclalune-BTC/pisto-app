import { ChevronRight } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

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
        value={amount}
      />
      <View className="gap-2">
        <Text className="text-sm font-semibold text-ink dark:text-[#E7EEE9]">
          {copy.cashAccount}
        </Text>
        <Pressable
          accessibilityLabel={copy.chooseCashAccount}
          accessibilityRole="button"
          className={`min-h-14 flex-row items-center justify-between gap-3 rounded-lg border bg-white px-4 active:opacity-75 dark:bg-[#14241D] ${
            errors.cashAccount ? "border-danger" : "border-line dark:border-[#3B4A43]"
          }`}
          onPress={onChooseCashAccount}
        >
          <Text className="min-w-0 flex-1 text-base text-ink dark:text-white">
            {selectedCashAccountName ?? copy.chooseCashAccount}
          </Text>
          <ChevronRight color="#617168" size={18} />
        </Pressable>
        {errors.cashAccount ? (
          <Text accessibilityRole="alert" className="text-xs text-danger">
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
            value={date}
          />
        </View>
        <View className="min-w-0 flex-1">
          <Field
            error={errors.time}
            label={copy.time}
            onChangeText={(value) => onChange("time", value)}
            value={time}
          />
        </View>
      </View>
      <Field
        error={errors.reference}
        label={`${copy.reference} (${copy.optional})`}
        onChangeText={(value) => onChange("reference", value)}
        value={reference}
      />
      <View className="gap-3 sm:flex-row sm:justify-end">
        <Button label={copy.cancel} onPress={onCancel} variant="ghost" />
        <Button disabled={!canReview} label={copy.review} onPress={onReview} variant="accent" />
      </View>
    </View>
  );
}
