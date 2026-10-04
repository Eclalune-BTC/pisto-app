import type { DateFieldProps } from "./date-field";
import { PickerField } from "./picker-field.web";

export function DateField(props: DateFieldProps) {
  return <PickerField {...props} type="date" />;
}
