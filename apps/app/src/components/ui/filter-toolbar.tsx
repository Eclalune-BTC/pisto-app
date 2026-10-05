import type { PropsWithChildren } from "react";
import { View } from "react-native";

import { Button } from "./button";

type FilterToolbarProps = PropsWithChildren<{
  label: string;
  onReset?: () => void;
  resetLabel?: string;
}>;

/** The filters of a list, in one row under its section title; it wraps on narrow screens. */
export function FilterToolbar({ children, label, onReset, resetLabel }: FilterToolbarProps) {
  return (
    <View
      accessibilityLabel={label}
      className="min-w-0 flex-row flex-wrap items-center gap-2"
      role="group"
    >
      {children}
      {onReset && resetLabel ? (
        <Button label={resetLabel} onPress={onReset} size="sm" variant="ghost" />
      ) : null}
    </View>
  );
}
