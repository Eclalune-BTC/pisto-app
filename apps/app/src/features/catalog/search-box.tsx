import { Search, X } from "lucide-react-native";
import type { Ref } from "react";
import { type TextInput, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { SEARCH_MAX_LENGTH } from "./search-params";

type SearchBoxProps = {
  /** The typed search is not applied yet or its results are still loading. */
  busy: boolean;
  clearLabel: string;
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** Lets the list take focus back to the search after its filters are cleared. */
  ref?: Ref<TextInput>;
  value: string;
};

/** A toolbar search: the icon and placeholder say what it does, the label names it for readers. */
export function SearchBox({
  busy,
  clearLabel,
  label,
  onChange,
  placeholder,
  ref,
  value,
}: SearchBoxProps) {
  return (
    <View className="relative min-w-0">
      <View className="pointer-events-none absolute inset-y-0 left-2.5 z-10 justify-center">
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
        className="pl-8 pr-9 native:pl-9"
        enterKeyHint="search"
        inputMode="search"
        maxLength={SEARCH_MAX_LENGTH}
        onChangeText={onChange}
        placeholder={placeholder}
        ref={ref}
        role="searchbox"
        value={value}
      />
      {value ? (
        <View className="absolute inset-y-0 right-0.5 justify-center">
          <Button
            accessibilityLabel={clearLabel}
            onPress={() => onChange("")}
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
