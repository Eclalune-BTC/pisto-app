import type { PropsWithChildren } from "react";
import { View } from "react-native";

import { Button } from "./button";
import { Card, CardContent } from "./card";

type FilterToolbarProps = PropsWithChildren<{
  label: string;
  onReset?: () => void;
  resetLabel?: string;
}>;

export function FilterToolbar({ children, label, onReset, resetLabel }: FilterToolbarProps) {
  return (
    <Card accessibilityLabel={label} className="min-w-0 gap-0 py-4 shadow-none" role="group">
      <CardContent className="min-w-0 gap-3 px-4">
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
      </CardContent>
    </Card>
  );
}
