import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

import type { CustomerFormCopy } from "./types";

type CustomerFormProps = {
  copy: CustomerFormCopy;
  email: string;
  errors: Partial<Record<"email" | "name" | "notes" | "phone", string>>;
  name: string;
  notes: string;
  onCancel: () => void;
  onChange: (field: "email" | "name" | "notes" | "phone", value: string) => void;
  onSubmit: () => void;
  phone: string;
};

export function CustomerForm({
  copy,
  email,
  errors,
  name,
  notes,
  onCancel,
  onChange,
  onSubmit,
  phone,
}: CustomerFormProps) {
  return (
    <View className="gap-5">
      <Field
        autoCapitalize="words"
        error={errors.name}
        label={copy.name}
        onChangeText={(value) => onChange("name", value)}
        placeholder={copy.namePlaceholder}
        value={name}
      />
      <View className="gap-5 sm:flex-row">
        <View className="min-w-0 flex-1">
          <Field
            error={errors.phone}
            keyboardType="phone-pad"
            label={copy.phone}
            onChangeText={(value) => onChange("phone", value)}
            placeholder={copy.phonePlaceholder}
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
            placeholder={copy.emailPlaceholder}
            value={email}
          />
        </View>
      </View>
      <Field
        error={errors.notes}
        label={copy.notes}
        multiline
        onChangeText={(value) => onChange("notes", value)}
        placeholder={copy.notesPlaceholder}
        value={notes}
      />
      <View className="gap-3 sm:flex-row sm:justify-end">
        <Button label={copy.cancel} onPress={onCancel} variant="ghost" />
        <Button label={copy.save} onPress={onSubmit} variant="accent" />
      </View>
    </View>
  );
}
