import { useQuery } from "@tanstack/react-query";
import { type Href, Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { RouteState } from "@/components/route-state";
import { useRouteLabel } from "@/components/shell/shell-context";
import { manageCapabilityBoundaryState, useCapabilityAccess } from "@/features/customers/access";
import { CustomerEditor } from "@/features/customers/customer-editor";
import { customerDetailQueryOptions } from "@/features/customers/queries";
import { readState } from "@/features/customers/read-state";
import { hasDeniedRead } from "@/lib/query-state";
import { firstParam } from "@/lib/route-params";

export default function EditCustomerRoute() {
  const router = useRouter();
  const customerId = firstParam(
    useLocalSearchParams<{ customerId?: string | string[] }>().customerId,
  );
  const access = useCapabilityAccess("customers:read", "customers:manage");
  const businessId = access.business?.id;
  const customer = useQuery({
    ...customerDetailQueryOptions(businessId, customerId),
    enabled: Boolean(access.business && access.hasManagePermission && customerId),
  });
  useRouteLabel(
    "/operate/customers/[customerId]",
    manageCapabilityBoundaryState(access) === "ready" && !hasDeniedRead([customer])
      ? customer.data?.customer.name
      : undefined,
  );

  const accessState = manageCapabilityBoundaryState(access);
  if (!access.business && accessState === "ready") return <Redirect href="/business" />;
  if (accessState !== "ready") {
    return (
      <RouteState
        kind={accessState}
        onRetry={() => void access.refetch()}
        variant="form"
        width="form"
      />
    );
  }

  const read = customerId ? readState([customer]) : { kind: "notFound" as const };
  if (read.kind !== "ready" || !access.business || !customer.data || !customerId) {
    return (
      <RouteState
        kind={read.kind === "ready" ? "error" : read.kind}
        onRetry={() => void customer.refetch()}
        variant="form"
        width="form"
      />
    );
  }

  const detailHref: Href = {
    pathname: "/operate/customers/[customerId]",
    params: { customerId },
  };
  return (
    <CustomerEditor
      availability={
        customer.data.customer.status === "archived"
          ? "unavailable"
          : read.stale || access.isStale
            ? "stale"
            : "available"
      }
      businessId={access.business.id}
      cancelHref={detailHref}
      customer={customer.data.customer}
      onConfirmed={() => router.replace(detailHref)}
      onRetryRead={() => {
        void access.refetch();
        void customer.refetch();
      }}
    />
  );
}
