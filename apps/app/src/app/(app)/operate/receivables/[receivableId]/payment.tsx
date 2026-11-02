import { useQuery } from "@tanstack/react-query";
import { type Href, Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { PageHeader } from "@/components/layout/page-header";
import { Page } from "@/components/page";
import { RouteState } from "@/components/route-state";
import { useRouteLabel } from "@/components/shell/shell-context";
import { manageCapabilityBoundaryState, useCapabilityAccess } from "@/features/customers/access";
import { receivableDetailQueryOptions } from "@/features/receivables/queries";
import { ReceivablePaymentForm } from "@/features/receivables/receivable-payment-form";
import { hasDeniedRead } from "@/lib/query-state";
import { firstParam } from "@/lib/route-params";

export default function ApplyPaymentRoute() {
  const router = useRouter();
  const { t } = useTranslation();
  const receivableId = firstParam(
    useLocalSearchParams<{ receivableId?: string | string[] }>().receivableId,
  );
  const access = useCapabilityAccess("receivables:read", "receivables:manage");
  const businessId = access.business?.id;
  // The form reads the same detail; this read only names the record in the breadcrumb.
  const detail = useQuery({
    ...receivableDetailQueryOptions(businessId, receivableId),
    enabled: Boolean(access.business && access.hasManagePermission && receivableId),
  });
  useRouteLabel(
    "/operate/receivables/[receivableId]",
    manageCapabilityBoundaryState(access) === "ready" && !hasDeniedRead([detail])
      ? detail.data?.receivable.description
      : undefined,
  );

  const accessState = manageCapabilityBoundaryState(access);
  if (!access.business && accessState === "ready") return <Redirect href="/business" />;
  if (accessState !== "ready" || !access.business || !receivableId) {
    return (
      <RouteState
        kind={accessState === "ready" ? "notFound" : accessState}
        onRetry={() => void access.refetch()}
        variant="form"
        width="form"
      />
    );
  }

  const detailHref: Href = {
    pathname: "/operate/receivables/[receivableId]",
    params: { receivableId },
  };
  return (
    <Page width="form">
      <PageHeader
        description={t("receivables.paymentForm.pageDescription")}
        title={t("receivables.paymentForm.title")}
      />
      <View className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <ReceivablePaymentForm
          entrySource="manual"
          onCancel={() => router.replace(detailHref)}
          onSaved={() => router.replace(detailHref)}
          receivableId={receivableId}
        />
      </View>
    </Page>
  );
}
