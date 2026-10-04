import type { Ref } from "react";
import { useTranslation } from "react-i18next";
import type { TextInput } from "react-native";
import { Field } from "./field";

export type PickerFieldProps = {
  description?: string;
  disabled?: boolean;
  error?: string;
  label: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  /** Lets a form move focus to the field when validation rejects it. */
  ref?: Ref<TextInput | HTMLInputElement>;
  value: string;
};

export type DateFieldProps = PickerFieldProps;

/** `YYYY-MM-DD` entry on native; the web adapter uses the browser date input. */
export function DateField({
  description,
  disabled,
  error,
  label,
  onChange,
  onSubmit,
  ref,
  value,
}: DateFieldProps) {
  const { t } = useTranslation();
  return (
    <Field
      autoCapitalize="none"
      autoCorrect={false}
      description={description}
      editable={!disabled}
      error={error}
      label={label}
      maxLength={10}
      keyboardType="numbers-and-punctuation"
      onChangeText={onChange}
      onSubmitEditing={onSubmit}
      placeholder={t("filters.dateFormat")}
      ref={ref as Ref<TextInput>}
      value={value}
    />
  );
}
