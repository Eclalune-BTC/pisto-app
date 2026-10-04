import type { PropsWithChildren } from "react";
import { View } from "react-native";

import { Button } from "./button";

type FilterToolbarProps = PropsWithChildren<{
  label: string;
  onReset?: () => void;
  resetLabel?: string;
}>;

export function FilterToolbar({ children, label, onReset, resetLabel }: FilterToolbarProps) {
  return (
    <View accessibilityLabel={label} className="min-w-0 gap-3" role="group">
      <View className="min-w-0 gap-4 sm:flex-row sm:flex-wrap sm:items-end">{children}</View>
      {onReset && resetLabel ? (
        <Button
          className="self-start"
          label={resetLabel}
          onPress={onReset}
          size="sm"
          variant="ghost"
        />
      ) : null}
    </View>
  );
}
