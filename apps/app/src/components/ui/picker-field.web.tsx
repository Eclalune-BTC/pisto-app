import { type Ref, useId } from "react";
import { DEFAULT_LOCALE } from "@/i18n/locale";
import type { PickerFieldProps } from "./date-field";

/** Native browser date/time input styled like `Field`; values stay `YYYY-MM-DD` / `HH:MM`. */
export function PickerField({
  description,
  disabled,
  error,
  label,
  onChange,
  onSubmit,
  ref,
  type,
  value,
}: PickerFieldProps & { type: "date" | "time" }) {
  const id = useId();
  const hint = error ? undefined : description;
  const describedBy = error ? `${id}-error` : hint ? `${id}-description` : undefined;
  return (
    <div className="pisto-picker-field">
      <label htmlFor={id}>{label}</label>
      <input
        aria-describedby={describedBy}
        aria-invalid={Boolean(error)}
        disabled={disabled}
        id={id}
        lang={DEFAULT_LOCALE}
        onChange={(event) => onChange(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && onSubmit) {
            event.preventDefault();
            onSubmit();
          }
        }}
        ref={ref as Ref<HTMLInputElement>}
        step={type === "time" ? 60 : undefined}
        type={type}
        value={value}
      />
      {error ? (
        <span aria-live="polite" id={`${id}-error`} role="alert">
          {error}
        </span>
      ) : null}
      {hint ? (
        <span className="pisto-picker-field-description" id={`${id}-description`}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}
