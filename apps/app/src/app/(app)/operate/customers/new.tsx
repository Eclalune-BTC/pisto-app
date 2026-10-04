import { Redirect, useRouter } from "expo-router";

import { manageCapabilityBoundaryState, useCapabilityAccess } from "@/features/customers/access";
import { CustomerEditor } from "@/features/customers/customer-editor";
import { ScreenState } from "@/features/customers/screen-state";

export default function NewCustomerRoute() {
  const router = useRouter();
  const access = useCapabilityAccess("customers:read", "customers:manage");
  const accessState = manageCapabilityBoundaryState(access);

  if (!access.business && accessState === "ready") return <Redirect href="/business" />;
  if (accessState !== "ready" || !access.business) {
    return (
      <ScreenState
        kind={accessState === "ready" ? "error" : accessState}
        onRetry={() => void access.refetch()}
        skeleton="form"
        width="form"
      />
    );
  }

  return (
    <CustomerEditor
      availability={access.isStale ? "stale" : "available"}
      businessId={access.business.id}
      cancelHref="/operate/customers"
      onConfirmed={(customer) =>
        router.replace({
          pathname: "/operate/customers/[customerId]",
          params: { customerId: customer.id },
        })
      }
      onRetryRead={() => void access.refetch()}
    />
  );
}
