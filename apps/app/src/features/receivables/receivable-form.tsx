import { ChevronRight } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

import type { ReceivableFormCopy } from "./types";

type ReceivableFormProps = {
  amount: string;
  canReview: boolean;
  copy: ReceivableFormCopy;
  description: string;
  dueDate: string;
  errors: Partial<Record<"amount" | "customer" | "description" | "dueDate" | "postedDate", string>>;
  onCancel: () => void;
  onChange: (field: "amount" | "description" | "dueDate" | "postedDate", value: string) => void;
  onChooseCustomer: () => void;
  onReview: () => void;
  postedDate: string;
  selectedCustomerName: string | null;
};

export function ReceivableForm({
  amount,
  canReview,
  copy,
  description,
  dueDate,
  errors,
  onCancel,
  onChange,
  onChooseCustomer,
  onReview,
  postedDate,
  selectedCustomerName,
}: ReceivableFormProps) {
  return (
    <View className="gap-5">
      <View className="gap-2">
        <Text className="text-sm font-semibold text-ink dark:text-[#E7EEE9]">{copy.customer}</Text>
        <Pressable
          accessibilityLabel={copy.chooseCustomer}
          accessibilityRole="button"
          className={`min-h-14 flex-row items-center justify-between gap-3 rounded-lg border bg-white px-4 active:opacity-75 dark:bg-[#14241D] ${
            errors.customer ? "border-danger" : "border-line dark:border-[#3B4A43]"
          }`}
          onPress={onChooseCustomer}
        >
          <Text className="min-w-0 flex-1 text-base text-ink dark:text-white">
            {selectedCustomerName ?? copy.chooseCustomer}
          </Text>
          <ChevronRight color="#617168" size={18} />
        </Pressable>
        {errors.customer ? (
          <Text accessibilityRole="alert" className="text-xs text-danger">
            {errors.customer}
          </Text>
        ) : null}
      </View>
      <View className="gap-5 sm:flex-row">
        <View className="min-w-0 flex-1">
          <Field
            error={errors.amount}
            keyboardType="decimal-pad"
            label={copy.amount}
            onChangeText={(value) => onChange("amount", value)}
            placeholder={copy.amountPlaceholder}
            value={amount}
          />
        </View>
        <View className="min-w-0 flex-1">
          <Field
            error={errors.postedDate}
            label={copy.postedDate}
            onChangeText={(value) => onChange("postedDate", value)}
            placeholder={copy.datePlaceholder}
            value={postedDate}
          />
        </View>
      </View>
      <Field
        error={errors.dueDate}
        label={`${copy.dueDate} (${copy.optional})`}
        onChangeText={(value) => onChange("dueDate", value)}
        placeholder={copy.datePlaceholder}
        value={dueDate}
      />
      <Field
        error={errors.description}
        label={copy.description}
        multiline
        onChangeText={(value) => onChange("description", value)}
        placeholder={copy.descriptionPlaceholder}
        value={description}
      />
      <View className="gap-3 sm:flex-row sm:justify-end">
        <Button label={copy.cancel} onPress={onCancel} variant="ghost" />
        <Button disabled={!canReview} label={copy.review} onPress={onReview} variant="accent" />
      </View>
    </View>
  );
}
