import { uuidSchema } from "@pisto/contracts";
import { useQuery } from "@tanstack/react-query";
import { type Href, Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { PageHeader } from "@/components/layout/page-header";
import { Page } from "@/components/page";
import { RouteState } from "@/components/route-state";
import { manageCapabilityBoundaryState, useCapabilityAccess } from "@/features/customers/access";
import { readState } from "@/features/customers/read-state";
import { PurchaseForm } from "@/features/purchases/purchase-form";
import { supplierQueryOptions } from "@/features/purchases/queries";
import { firstParam } from "@/lib/route-params";

export default function NewPurchaseRoute() {
  const { t } = useTranslation();
  const router = useRouter();
  const requested = firstParam(
    useLocalSearchParams<{ supplierId?: string | string[] }>().supplierId,
  );
  const supplierId = uuidSchema.safeParse(requested).success ? requested : undefined;
  const access = useCapabilityAccess("purchases:read", "purchases:manage");
  const supplier = useQuery({
    ...supplierQueryOptions(access.business?.id, supplierId),
    enabled: Boolean(access.business && access.hasManagePermission && supplierId),
  });
  const accessState = manageCapabilityBoundaryState(access);
  if (!access.business && accessState === "ready") return <Redirect href="/business" />;
  if (accessState !== "ready" || !access.business) {
    return (
      <RouteState
        kind={accessState === "ready" ? "error" : accessState}
        onRetry={() => void access.refetch()}
        variant="form"
      />
    );
  }
  // A purchase started from a supplier waits for that supplier, so the form opens with it chosen.
  if (supplierId) {
    const read = readState([supplier]);
    if (read.kind !== "ready") {
      return (
        <RouteState
          kind={read.kind === "notFound" ? "notFound" : read.kind}
          onRetry={() => void supplier.refetch()}
          variant="form"
        />
      );
    }
  }
  const origin: Href = supplierId
    ? { pathname: "/operate/suppliers", params: { supplierId } }
    : "/operate/payables";
  const chosen = supplier.data?.supplier;
  return (
    <Page>
      <PageHeader description={t("purchases.form.description")} title={t("purchases.form.title")} />
      <PurchaseForm
        entrySource="manual"
        initialSupplier={
          chosen?.status === "active"
            ? { creditDays: chosen.creditDays, id: chosen.id, name: chosen.name }
            : undefined
        }
        onCancel={() => router.replace(origin)}
        onSaved={(purchaseId) =>
          router.replace({ pathname: "/operate/purchases/[purchaseId]", params: { purchaseId } })
        }
      />
    </Page>
  );
}
