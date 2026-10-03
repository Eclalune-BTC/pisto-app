import { ChevronRight } from "lucide-react-native";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Text } from "@/components/ui/text";

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
        <Text className="text-sm font-ui text-foreground ">{copy.customer}</Text>
        <Button
          accessibilityLabel={copy.chooseCustomer}
          className={`min-h-14 flex-row items-center justify-between gap-3 rounded-md border bg-background px-4 active:opacity-75 ${
            errors.customer ? "border-destructive" : "border-border "
          }`}
          onPress={onChooseCustomer}
          variant="ghost"
        >
          <Text className="min-w-0 flex-1 text-base text-foreground">
            {selectedCustomerName ?? copy.chooseCustomer}
          </Text>
          <ChevronRight color="#617168" size={18} />
        </Button>
        {errors.customer ? (
          <Text accessibilityRole="alert" className="text-xs text-destructive">
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
        <Button disabled={!canReview} label={copy.review} onPress={onReview} variant="default" />
      </View>
    </View>
  );
}
