import type { Ref } from "react";
import { useTranslation } from "react-i18next";
import type { TextInput } from "react-native";
import type { PickerFieldProps } from "./date-field";
import { Field } from "./field";

export type TimeFieldProps = PickerFieldProps;

/** 24-hour `HH:MM` entry on native; the web adapter uses the browser time input. */
export function TimeField({
  description,
  disabled,
  error,
  label,
  onChange,
  onSubmit,
  ref,
  value,
}: TimeFieldProps) {
  const { t } = useTranslation();
  return (
    <Field
      autoCapitalize="none"
      autoCorrect={false}
      description={description}
      editable={!disabled}
      error={error}
      label={label}
      maxLength={5}
      keyboardType="numbers-and-punctuation"
      onChangeText={onChange}
      onSubmitEditing={onSubmit}
      placeholder={t("filters.timeFormat")}
      ref={ref as Ref<TextInput>}
      value={value}
    />
  );
}
