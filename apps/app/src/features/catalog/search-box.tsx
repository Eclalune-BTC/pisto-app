import { Search } from "lucide-react-native";
import { View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { SEARCH_MAX_LENGTH } from "./search-params";

type SearchBoxProps = {
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
};

/** A toolbar search: the icon and placeholder say what it does, the label names it for readers. */
export function SearchBox({ label, onChange, placeholder, value }: SearchBoxProps) {
  return (
    <View className="relative min-w-0">
      <View className="pointer-events-none absolute inset-y-0 left-2.5 z-10 justify-center">
        <Icon as={Search} className="text-muted-foreground" size={15} />
      </View>
      <Input
        accessibilityLabel={label}
        autoCapitalize="none"
        autoCorrect={false}
        className="pl-8 native:pl-9"
        enterKeyHint="search"
        inputMode="search"
        maxLength={SEARCH_MAX_LENGTH}
        onChangeText={onChange}
        placeholder={placeholder}
        value={value}
      />
    </View>
  );
}
