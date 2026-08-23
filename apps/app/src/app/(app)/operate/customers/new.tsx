import { Redirect, useRouter } from "expo-router";

import { manageCapabilityBoundaryState, useCapabilityAccess } from "@/features/customers/access";
import { CapabilityBoundary } from "@/features/customers/capability-boundary";
import { CustomerEditor } from "@/features/customers/customer-editor";

export default function NewCustomerRoute() {
  const router = useRouter();
  const access = useCapabilityAccess("customers:read", "customers:manage");
  const boundaryState = manageCapabilityBoundaryState(access);

  if (!access.business && boundaryState === "ready") return <Redirect href="/business" />;

  return (
    <CapabilityBoundary onRetry={() => access.refetch()} state={boundaryState}>
      {access.business ? (
        <CustomerEditor
          businessId={access.business.id}
          onBack={() => router.replace("/operate/customers")}
          onConfirmed={(customerId) =>
            router.replace({
              pathname: "/operate/customers/[customerId]",
              params: { customerId },
            })
          }
        />
      ) : null}
    </CapabilityBoundary>
  );
}
