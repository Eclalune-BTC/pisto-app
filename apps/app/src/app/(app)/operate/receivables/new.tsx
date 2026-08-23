import { Redirect, useLocalSearchParams, useRouter } from "expo-router";

import { manageCapabilityBoundaryState, useCapabilityAccess } from "@/features/customers/access";
import { CapabilityBoundary } from "@/features/customers/capability-boundary";
import { ReceivableEditor } from "@/features/receivables/receivable-editor";

export default function NewReceivableRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ customerId?: string | string[] }>();
  const customerId = Array.isArray(params.customerId) ? params.customerId[0] : params.customerId;
  const access = useCapabilityAccess("receivables:read", "receivables:manage");
  const boundaryState = manageCapabilityBoundaryState(access);

  if (!access.business && boundaryState === "ready") return <Redirect href="/business" />;

  return (
    <CapabilityBoundary onRetry={() => access.refetch()} state={boundaryState}>
      {access.business ? (
        <ReceivableEditor
          business={access.business}
          initialCustomerId={customerId}
          onBack={() => router.replace("/operate/receivables")}
          onConfirmed={(receivableId) =>
            router.replace({
              pathname: "/operate/receivables/[receivableId]",
              params: { receivableId },
            })
          }
        />
      ) : null}
    </CapabilityBoundary>
  );
}
