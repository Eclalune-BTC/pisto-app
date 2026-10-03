import { useTranslation } from "react-i18next";
import { Field } from "./field";

export type DateFieldProps = {
  disabled?: boolean;
  error?: string;
  label: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  value: string;
};

export function DateField({ disabled, error, label, onChange, onSubmit, value }: DateFieldProps) {
  const { t } = useTranslation();
  return (
    <Field
      autoCapitalize="none"
      autoCorrect={false}
      editable={!disabled}
      error={error}
      label={label}
      maxLength={10}
      keyboardType="numbers-and-punctuation"
      onChangeText={onChange}
      onSubmitEditing={onSubmit}
      placeholder={t("filters.dateFormat")}
      value={value}
    />
  );
}
