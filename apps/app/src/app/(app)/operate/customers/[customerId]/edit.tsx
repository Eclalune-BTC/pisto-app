import { useQuery } from "@tanstack/react-query";
import { type Href, Redirect, useLocalSearchParams, useRouter } from "expo-router";

import { useRouteLabel } from "@/components/shell/shell-context";
import { manageCapabilityBoundaryState, useCapabilityAccess } from "@/features/customers/access";
import { CustomerEditor } from "@/features/customers/customer-editor";
import { firstParam } from "@/features/customers/list-params";
import { customerDetailQueryOptions } from "@/features/customers/queries";
import { readState } from "@/features/customers/read-state";
import { ScreenState } from "@/features/customers/screen-state";

export default function EditCustomerRoute() {
  const router = useRouter();
  const customerId = firstParam(
    useLocalSearchParams<{ customerId?: string | string[] }>().customerId,
  );
  const access = useCapabilityAccess("customers:read", "customers:manage");
  const businessId = access.business?.id;
  const customer = useQuery({
    ...customerDetailQueryOptions(businessId, customerId),
    enabled: Boolean(access.business && access.canManage && customerId),
  });
  useRouteLabel("/operate/customers/[customerId]", customer.data?.customer.name);

  const accessState = manageCapabilityBoundaryState(access);
  if (!access.business && accessState === "ready") return <Redirect href="/business" />;
  if (accessState !== "ready") {
    return (
      <ScreenState
        kind={accessState}
        onRetry={() => void access.refetch()}
        skeleton="form"
        width="form"
      />
    );
  }

  const read = customerId ? readState([customer]) : { kind: "notFound" as const };
  if (read.kind !== "ready" || !access.business || !customer.data || !customerId) {
    return (
      <ScreenState
        kind={read.kind === "ready" ? "error" : read.kind}
        onRetry={() => void customer.refetch()}
        skeleton="form"
        width="form"
      />
    );
  }
  if (customer.data.customer.status === "archived") {
    return <ScreenState kind="unavailable" width="form" />;
  }

  const detailHref: Href = {
    pathname: "/operate/customers/[customerId]",
    params: { customerId },
  };
  return (
    <CustomerEditor
      businessId={access.business.id}
      cancelHref={detailHref}
      customer={customer.data.customer}
      onConfirmed={() => router.replace(detailHref)}
    />
  );
}
