import { Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

import { type CustomerFormCopy, customerPrimaryAction, type MutationState } from "./types";

type CustomerFormProps = {
  copy: CustomerFormCopy;
  email: string;
  errors: Partial<Record<"email" | "name" | "notes" | "phone", string>>;
  mutation: MutationState;
  name: string;
  notes: string;
  onCancel: () => void;
  onChange: (field: "email" | "name" | "notes" | "phone", value: string) => void;
  onRetrySameRequest: () => void;
  onSubmit: () => void;
  phone: string;
};

export function CustomerForm({
  copy,
  email,
  errors,
  mutation,
  name,
  notes,
  onCancel,
  onChange,
  onRetrySameRequest,
  onSubmit,
  phone,
}: CustomerFormProps) {
  const primaryAction = customerPrimaryAction(mutation);
  return (
    <View className="gap-5">
      <Field
        autoCapitalize="words"
        error={errors.name}
        label={copy.name}
        onChangeText={(value) => onChange("name", value)}
        value={name}
      />
      <View className="gap-5 sm:flex-row">
        <View className="min-w-0 flex-1">
          <Field
            error={errors.phone}
            keyboardType="phone-pad"
            label={copy.phone}
            onChangeText={(value) => onChange("phone", value)}
            value={phone}
          />
        </View>
        <View className="min-w-0 flex-1">
          <Field
            autoCapitalize="none"
            error={errors.email}
            keyboardType="email-address"
            label={copy.email}
            onChangeText={(value) => onChange("email", value)}
            value={email}
          />
        </View>
      </View>
      <Field
        error={errors.notes}
        label={copy.notes}
        multiline
        onChangeText={(value) => onChange("notes", value)}
        value={notes}
      />
      {mutation.kind === "error" ? (
        <Text accessibilityRole="alert" className="text-sm text-danger">
          {mutation.message}
        </Text>
      ) : mutation.kind === "uncertain" ? (
        <View className="gap-2 border-l-4 border-warning bg-[#FFF6E8] p-4 dark:bg-[#3A2A18]">
          <Text className="font-bold text-ink dark:text-white">{copy.uncertainTitle}</Text>
          <Text className="text-sm leading-5 text-ink-muted dark:text-[#D5C8B8]">
            {mutation.message}
          </Text>
        </View>
      ) : null}
      <View className="gap-3 sm:flex-row sm:justify-end">
        <Button
          disabled={primaryAction === "waiting"}
          label={copy.cancel}
          onPress={onCancel}
          variant="ghost"
        />
        {primaryAction === "retry" ? (
          <Button label={copy.retrySameRequest} onPress={onRetrySameRequest} variant="accent" />
        ) : primaryAction === "submit" || primaryAction === "waiting" ? (
          <Button
            label={copy.save}
            loading={primaryAction === "waiting"}
            onPress={onSubmit}
            variant="accent"
          />
        ) : null}
      </View>
    </View>
  );
}
