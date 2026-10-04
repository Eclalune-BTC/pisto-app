import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";

function Rows({ count }: { count: number }) {
  return (
    <View className="overflow-hidden rounded-lg border border-border bg-card">
      <View className="h-9 flex-row items-center gap-6 border-b border-border bg-muted px-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="ml-auto h-3 w-20" />
      </View>
      {Array.from({ length: count }, (_, index) => (
        <View
          className="h-10 flex-row items-center gap-6 border-b border-border px-3 last:border-b-0"
          // biome-ignore lint/suspicious/noArrayIndexKey: Placeholder rows have no identity.
          key={index}
        >
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="ml-auto h-3 w-16" />
        </View>
      ))}
    </View>
  );
}

/**
 * Layout-shaped placeholders while a read is pending. The visible label keeps the loading state
 * announced for assistive technology without a page-level spinner.
 */
export function ContentSkeleton({
  label,
  variant,
}: {
  label?: string;
  variant: "list" | "detail" | "form" | "section";
}) {
  const { t } = useTranslation();
  return (
    <View accessibilityLabel={label ?? t("common.loadingContent")} aria-busy className="gap-6">
      <Text className="sr-only">{label ?? t("common.loadingContent")}</Text>
      {variant === "section" ? null : (
        <View className="gap-2">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </View>
      )}
      {variant === "detail" ? (
        <View className="flex-row flex-wrap gap-px overflow-hidden rounded-lg border border-border bg-border">
          {[0, 1, 2].map((index) => (
            <View className="min-w-[160px] flex-1 gap-2 bg-card p-4" key={index}>
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-28" />
            </View>
          ))}
        </View>
      ) : null}
      {variant === "form" ? (
        <View className="gap-4">
          {[0, 1, 2].map((index) => (
            <View className="gap-1.5" key={index}>
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-9 w-full" />
            </View>
          ))}
        </View>
      ) : (
        <Rows count={variant === "section" ? 4 : 6} />
      )}
    </View>
  );
}
