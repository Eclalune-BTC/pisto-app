import { Search, X } from "lucide-react-native";
import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { LoadingIndicator } from "@/components/ui/loading-indicator";

type SearchFieldProps = {
  autoFocus?: boolean;
  /** The typed search is still being applied; the leading icon becomes a spinner. */
  busy?: boolean;
  clearLabel: string;
  label: string;
  maxLength?: number;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
};

/** A labelled search box with a leading icon and a clear action once it holds text. */
export function SearchField({
  autoFocus,
  busy = false,
  clearLabel,
  label,
  maxLength,
  onChangeText,
  placeholder,
  value,
}: SearchFieldProps) {
  return (
    <View className="relative min-w-0">
      <View
        className="absolute inset-y-0 left-2.5 z-10 justify-center"
        style={{ pointerEvents: "none" }}
      >
        {busy ? (
          <LoadingIndicator size="small" />
        ) : (
          <Icon as={Search} className="text-muted-foreground" size={15} />
        )}
      </View>
      <Input
        accessibilityLabel={label}
        aria-busy={busy}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus={autoFocus}
        className="pl-8 pr-9"
        enterKeyHint="search"
        inputMode="search"
        maxLength={maxLength}
        onChangeText={onChangeText}
        placeholder={placeholder}
        role="searchbox"
        value={value}
      />
      {value ? (
        <View className="absolute inset-y-0 right-0.5 justify-center">
          <Button
            accessibilityLabel={clearLabel}
            onPress={() => onChangeText("")}
            size="icon-sm"
            variant="ghost"
          >
            <Icon as={X} className="text-muted-foreground" size={14} />
          </Button>
        </View>
      ) : null}
    </View>
  );
}
