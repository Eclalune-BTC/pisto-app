import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export type CursorPage = { hasMore: boolean; loadingMore: boolean; onLoadMore: () => void };

/** Requests the next server page; the loaded rows are never presented as the complete set. */
export function LoadMoreButton({
  className,
  label,
  page,
}: {
  className?: string;
  label?: string;
  page: CursorPage;
}) {
  const { t } = useTranslation();
  if (!page.hasMore) return null;
  return (
    <Button
      className={cn("self-center", className)}
      label={page.loadingMore ? t("common.loadingMore") : (label ?? t("common.loadMore"))}
      loading={page.loadingMore}
      onPress={page.onLoadMore}
      size="sm"
      variant="outline"
    />
  );
}
