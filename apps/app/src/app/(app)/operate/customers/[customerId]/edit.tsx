import { useQuery } from "@tanstack/react-query";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { manageCapabilityBoundaryState, useCapabilityAccess } from "@/features/customers/access";
import { ActionUnavailable } from "@/features/customers/action-unavailable";
import { CapabilityBoundary } from "@/features/customers/capability-boundary";
import { buildCustomersCopy } from "@/features/customers/copy";
import { CustomerEditor } from "@/features/customers/customer-editor";
import { customerDetailQueryOptions } from "@/features/customers/queries";
import { RecordBoundary, type RecordBoundaryState } from "@/features/customers/record-boundary";
import { isPausedWithoutData, readFailureKind } from "@/features/customers/remote-state";

export default function EditCustomerRoute() {
  const { t } = useTranslation();
  const copy = useMemo(() => buildCustomersCopy(t), [t]);
  const router = useRouter();
  const params = useLocalSearchParams<{ customerId?: string | string[] }>();
  const customerId = Array.isArray(params.customerId) ? params.customerId[0] : params.customerId;
  const access = useCapabilityAccess("customers:read", "customers:manage");
  const businessId = access.business?.id ?? "inactive-business";
  const customer = useQuery({
    ...customerDetailQueryOptions(businessId, customerId ?? "missing-customer"),
    enabled: Boolean(access.business && access.canManage && customerId),
  });
  const boundaryState = manageCapabilityBoundaryState(access);

  if (!access.business && boundaryState === "ready") return <Redirect href="/business" />;

  let recordState: RecordBoundaryState;
  if (!customerId) recordState = "notFound";
  else if (isPausedWithoutData(customer.fetchStatus, Boolean(customer.data)))
    recordState = "offline";
  else if (customer.isPending) recordState = "loading";
  else if (customer.isError) recordState = readFailureKind(customer.error);
  else recordState = customer.data ? "ready" : "error";

  const goBack = () =>
    customerId
      ? router.replace({
          pathname: "/operate/customers/[customerId]",
          params: { customerId },
        })
      : router.replace("/operate/customers");

  return (
    <CapabilityBoundary onRetry={() => access.refetch()} state={boundaryState}>
      <RecordBoundary onBack={goBack} onRetry={() => customer.refetch()} state={recordState}>
        {access.business && customer.data ? (
          customer.data.customer.status === "archived" ? (
            <ActionUnavailable
              description={copy.customers.list.archivedDescription}
              onBack={goBack}
              title={copy.receivables.route.actionUnavailableTitle}
            />
          ) : (
            <CustomerEditor
              businessId={access.business.id}
              customer={customer.data.customer}
              onBack={goBack}
              onConfirmed={goBack}
            />
          )
        ) : null}
      </RecordBoundary>
    </CapabilityBoundary>
  );
}
