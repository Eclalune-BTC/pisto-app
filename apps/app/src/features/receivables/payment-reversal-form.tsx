import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

import type { PaymentReversalFormCopy } from "./types";

type PaymentReversalFormProps = {
  canReview: boolean;
  copy: PaymentReversalFormCopy;
  date: string;
  errors: Partial<Record<"date" | "reference" | "time", string>>;
  onCancel: () => void;
  onChange: (field: "date" | "reference" | "time", value: string) => void;
  onReview: () => void;
  reference: string;
  time: string;
};

export function PaymentReversalForm({
  canReview,
  copy,
  date,
  errors,
  onCancel,
  onChange,
  onReview,
  reference,
  time,
}: PaymentReversalFormProps) {
  return (
    <View className="gap-5">
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
        <Button disabled={!canReview} label={copy.review} onPress={onReview} variant="danger" />
      </View>
    </View>
  );
}
