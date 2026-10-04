import { Search, X } from "lucide-react-native";
import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";

type SearchFieldProps = {
  autoFocus?: boolean;
  clearLabel: string;
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
};

/** A labelled search box with a leading icon and a clear action once it holds text. */
export function SearchField({
  autoFocus,
  clearLabel,
  label,
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
        <Icon as={Search} className="text-muted-foreground" size={15} />
      </View>
      <Input
        accessibilityLabel={label}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus={autoFocus}
        className="pl-8 pr-9"
        enterKeyHint="search"
        inputMode="search"
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
