import { Text } from "@/components/ui/text";

/** Error for a control that, unlike `Field`, does not render its own (a select or a choice). */
export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <Text accessibilityRole="alert" className="text-sm text-destructive">
      {message}
    </Text>
  );
}
