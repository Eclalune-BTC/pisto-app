import { useId } from "react";
import type { DateFieldProps } from "./date-field";

export function DateField({ disabled, error, label, onChange, onSubmit, value }: DateFieldProps) {
  const id = useId();
  return (
    <div className="pisto-date-field">
      <label htmlFor={id}>{label}</label>
      <input
        aria-describedby={error ? `${id}-error` : undefined}
        aria-invalid={Boolean(error)}
        disabled={disabled}
        id={id}
        onChange={(event) => onChange(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && onSubmit) {
            event.preventDefault();
            onSubmit();
          }
        }}
        type="date"
        value={value}
      />
      {error ? (
        <span id={`${id}-error`} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
