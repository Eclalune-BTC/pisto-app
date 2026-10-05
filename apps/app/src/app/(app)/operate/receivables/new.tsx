import { uuidSchema } from "@pisto/contracts";
import { type Href, Redirect, useLocalSearchParams, useRouter } from "expo-router";

import { manageCapabilityBoundaryState, useCapabilityAccess } from "@/features/customers/access";
import { ScreenState } from "@/features/customers/screen-state";
import { ReceivableEditor } from "@/features/receivables/receivable-editor";
import { firstParam } from "@/lib/route-params";

export default function NewReceivableRoute() {
  const router = useRouter();
  const requested = firstParam(
    useLocalSearchParams<{ customerId?: string | string[] }>().customerId,
  );
  const customerId = uuidSchema.safeParse(requested).success ? requested : undefined;
  const access = useCapabilityAccess("receivables:read", "receivables:manage");
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

  // A charge started from a customer returns to that customer; otherwise to the list.
  const originHref: Href = customerId
    ? { pathname: "/operate/customers/[customerId]", params: { customerId } }
    : "/operate/receivables";
  return (
    <ReceivableEditor
      business={access.business}
      initialCustomerId={customerId}
      onConfirmed={() => router.replace(originHref)}
      onRetryRead={() => void access.refetch()}
      originHref={originHref}
      stale={access.isStale}
    />
  );
}
