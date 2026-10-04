import { CircleAlert, CircleCheck, TriangleAlert } from "lucide-react-native";
import { Toaster as WebToaster } from "sonner";
import { useUniwind } from "uniwind";
import { Icon } from "@/components/ui/icon";
import { LoadingIndicator } from "@/components/ui/loading-indicator";

export function Toaster() {
  const { theme } = useUniwind();
  return (
    <WebToaster
      gap={8}
      icons={{
        success: <Icon as={CircleCheck} className="text-foreground" size={16} />,
        warning: <Icon as={TriangleAlert} className="text-warning" size={16} />,
        error: <Icon as={CircleAlert} className="text-destructive" size={16} />,
        loading: <LoadingIndicator />,
      }}
      position="bottom-right"
      theme={theme === "dark" ? "dark" : "light"}
      toastOptions={{ style: { boxShadow: "0 8px 24px rgb(0 0 0 / 0.12)" } }}
      visibleToasts={4}
    />
  );
}
