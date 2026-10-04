import { PickerField } from "./picker-field.web";
import type { TimeFieldProps } from "./time-field";

export function TimeField(props: TimeFieldProps) {
  return <PickerField {...props} type="time" />;
}
