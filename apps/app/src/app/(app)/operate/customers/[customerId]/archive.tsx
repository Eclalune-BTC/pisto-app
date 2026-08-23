import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";

import { Page } from "@/components/page";
import { ScreenHeader } from "@/components/screen-header";
import { manageCapabilityBoundaryState, useCapabilityAccess } from "@/features/customers/access";
import { ActionUnavailable } from "@/features/customers/action-unavailable";
import { customersApi } from "@/features/customers/api";
import { CapabilityBoundary } from "@/features/customers/capability-boundary";
import { customersReceivablesCopy as copy } from "@/features/customers/copy";
import { CustomerArchiveReview } from "@/features/customers/customer-archive-review";
import { customerMutationState } from "@/features/customers/mutation-state";
import { customerDetailQueryOptions, customerQueryKeys } from "@/features/customers/queries";
import { RecordBoundary, type RecordBoundaryState } from "@/features/customers/record-boundary";
import { isPausedWithoutData, readFailureKind } from "@/features/customers/remote-state";

export default function ArchiveCustomerRoute() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ customerId?: string | string[] }>();
  const customerId = Array.isArray(params.customerId) ? params.customerId[0] : params.customerId;
  const access = useCapabilityAccess("customers:read", "customers:manage");
  const businessId = access.business?.id ?? "inactive-business";
  const [idempotencyKey] = useState(() => Crypto.randomUUID());
  const customer = useQuery({
    ...customerDetailQueryOptions(businessId, customerId ?? "missing-customer"),
    enabled: Boolean(access.business && access.canManage && customerId),
  });
  const mutation = useMutation({
    mutationFn: () => customersApi.archive(customerId as string, { idempotencyKey }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: customerQueryKeys.all(businessId) });
      goBack();
    },
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

  function goBack() {
    if (customerId) {
      router.replace({ pathname: "/operate/customers/[customerId]", params: { customerId } });
    } else {
      router.replace("/operate/customers");
    }
  }

  return (
    <CapabilityBoundary onRetry={() => access.refetch()} state={boundaryState}>
      <RecordBoundary onBack={goBack} onRetry={() => customer.refetch()} state={recordState}>
        {customer.data ? (
          customer.data.customer.status === "archived" ? (
            <ActionUnavailable
              description={copy.customers.archive.alreadyArchived}
              onBack={goBack}
              title={copy.receivables.route.actionUnavailableTitle}
            />
          ) : (
            <Page width="form">
              <ScreenHeader
                description={copy.customers.archive.description}
                title={copy.customers.archive.title}
              />
              <CustomerArchiveReview
                copy={copy.customers.form}
                customerName={customer.data.customer.name}
                mutation={customerMutationState(mutation)}
                onCancel={goBack}
                onConfirm={() => mutation.mutate()}
                onRetrySameRequest={() => mutation.mutate()}
              />
            </Page>
          )
        ) : null}
      </RecordBoundary>
    </CapabilityBoundary>
  );
}
