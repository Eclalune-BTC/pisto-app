import { CircleAlert, CircleCheck, TriangleAlert } from "lucide-react-native";
import { Toaster as NativeToaster } from "sonner-native";
import { useCSSVariable, useUniwind } from "uniwind";
import { Icon } from "@/components/ui/icon";
import { LoadingIndicator } from "@/components/ui/loading-indicator";

export function Toaster() {
  const { theme } = useUniwind();
  const [popover, foreground, muted, border, primary, primaryForeground] = useCSSVariable([
    "--color-popover",
    "--color-popover-foreground",
    "--color-muted-foreground",
    "--color-border",
    "--color-primary",
    "--color-primary-foreground",
  ]) as [string, string, string, string, string, string];
  return (
    <NativeToaster
      gap={8}
      icons={{
        success: <Icon as={CircleCheck} className="text-foreground" size={18} />,
        warning: <Icon as={TriangleAlert} className="text-warning" size={18} />,
        error: <Icon as={CircleAlert} className="text-destructive" size={18} />,
      }}
      loadingIcon={<LoadingIndicator />}
      position="top-center"
      swipeToDismissDirection="up"
      theme={theme === "dark" ? "dark" : "light"}
      toastOptions={{
        actionButtonStyle: { backgroundColor: primary, borderRadius: 3 },
        actionButtonTextStyle: { color: primaryForeground, fontFamily: "PistoMedium" },
        descriptionStyle: { color: muted, fontFamily: "PistoRegular", fontSize: 13 },
        style: {
          backgroundColor: popover,
          borderColor: border,
          borderRadius: 4,
          borderWidth: 1,
        },
        titleStyle: { color: foreground, fontFamily: "PistoMedium", fontSize: 14 },
      }}
    />
  );
}
