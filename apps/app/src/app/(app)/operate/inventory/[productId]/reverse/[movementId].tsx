import type { ReverseInventoryMovementRequest } from "@pisto/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { catalogInventoryCopy } from "@/features/catalog/copy";
import { useProductQuery } from "@/features/catalog/queries";
import { catalogInventoryQueryKeys, flattenPages } from "@/features/catalog/query-keys";
import { CapabilityRouteState } from "@/features/catalog/route-state";
import {
  isDeniedError,
  isNotFoundError,
  mutationErrorMessage,
  mutationUiState,
} from "@/features/catalog/state";
import { inventoryApi } from "@/features/inventory/api";
import { useMovementsQuery } from "@/features/inventory/queries";
import type { ReversalDraft, ReversalDraftErrors } from "@/features/inventory/reversal-draft";
import { buildReversalCommand } from "@/features/inventory/reversal-draft";
import { ReversalEditor } from "@/features/inventory/reversal-editor";
import { currentLocalDateTime } from "@/lib/money";
import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";

const emptyDraft: ReversalDraft = {
  occurredLocalDate: "",
  occurredLocalTime: "",
  reason: "",
};

function localizedErrors(errors: ReversalDraftErrors): ReversalDraftErrors {
  const copy = catalogInventoryCopy.reversal.validation;
  return {
    ...(errors.occurredLocalDate ? { occurredLocalDate: copy.date } : {}),
    ...(errors.occurredLocalTime ? { occurredLocalTime: copy.time } : {}),
    ...(errors.reason ? { reason: copy.reason } : {}),
  };
}

export default function ReverseInventoryMovementRoute() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{
    movementId?: string | string[];
    productId?: string | string[];
  }>();
  const productId = Array.isArray(params.productId) ? params.productId[0] : params.productId;
  const movementId = Array.isArray(params.movementId) ? params.movementId[0] : params.movementId;
  const businesses = useQuery(businessesQueryOptions);
  const business = getActiveBusiness(businesses.data);
  const canReadCatalog = business?.access.permissions.includes("catalog:read") ?? false;
  const canReadInventory = business?.access.permissions.includes("inventory:read") ?? false;
  const canManage = business?.access.permissions.includes("inventory:manage") ?? false;
  const product = useProductQuery({
    businessId: business?.id,
    enabled: Boolean(business && canReadCatalog),
    productId,
  });
  const movements = useMovementsQuery({
    businessId: business?.id,
    enabled: Boolean(business && canReadInventory),
    limit: 50,
    productId,
  });
  const movementItems = flattenPages(movements.data?.pages);
  const movement = movementItems.find(({ id }) => id === movementId);
  const [draft, setDraft] = useState<ReversalDraft>(emptyDraft);
  const [errors, setErrors] = useState<ReversalDraftErrors>({});
  const [command, setCommand] = useState<ReverseInventoryMovementRequest | null>(null);
  const [initializedBusiness, setInitializedBusiness] = useState<string | null>(null);

  useEffect(() => {
    if (!business || initializedBusiness === business.id) return;
    const current = currentLocalDateTime(business.timeZone);
    setDraft((value) => ({
      ...value,
      occurredLocalDate: current.date,
      occurredLocalTime: current.time,
    }));
    setInitializedBusiness(business.id);
  }, [business, initializedBusiness]);

  useEffect(() => {
    if (
      movementId &&
      !movement &&
      movements.hasNextPage &&
      !movements.isFetchingNextPage &&
      !movements.isError
    ) {
      void movements.fetchNextPage();
    }
  }, [
    movement,
    movementId,
    movements.fetchNextPage,
    movements.hasNextPage,
    movements.isError,
    movements.isFetchingNextPage,
  ]);

  const mutation = useMutation({
    mutationFn: (input: ReverseInventoryMovementRequest) =>
      inventoryApi.reverseMovement(movementId as string, input),
    networkMode: "always",
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: catalogInventoryQueryKeys.productsRoot(business?.id),
        }),
        queryClient.invalidateQueries({
          queryKey: catalogInventoryQueryKeys.stockRoot(business?.id),
        }),
        queryClient.invalidateQueries({
          queryKey: catalogInventoryQueryKeys.movementsRoot(business?.id, productId),
        }),
      ]);
      router.replace({
        pathname: "/operate/inventory/[productId]",
        params: { productId: productId as string },
      });
    },
  });

  const back = {
    label: catalogInventoryCopy.remote.backToInventory,
    onPress: () =>
      productId
        ? router.replace({ pathname: "/operate/inventory/[productId]", params: { productId } })
        : router.replace("/operate/inventory"),
  };

  if (businesses.fetchStatus === "paused") {
    return <CapabilityRouteState back={back} kind="offline" />;
  }
  if (businesses.isPending) return <CapabilityRouteState kind="loading" />;
  if (businesses.isError) {
    return (
      <CapabilityRouteState back={back} kind="error" onRetry={() => void businesses.refetch()} />
    );
  }
  if (!business) return <Redirect href="/business" />;
  if (!canReadCatalog || !canReadInventory || !canManage) {
    return <CapabilityRouteState back={back} kind="denied" />;
  }
  if (isDeniedError(product.error) || isDeniedError(movements.error)) {
    return <CapabilityRouteState back={back} kind="denied" />;
  }
  if (product.fetchStatus === "paused" || movements.fetchStatus === "paused") {
    return <CapabilityRouteState back={back} kind="offline" />;
  }
  if (product.isPending || movements.isPending || (!movement && movements.hasNextPage)) {
    return <CapabilityRouteState kind="loading" />;
  }
  if (
    !productId ||
    !movementId ||
    isNotFoundError(product.error) ||
    isNotFoundError(movements.error) ||
    (!movement && Boolean(movements.data) && !movements.hasNextPage && !movements.isError)
  ) {
    return <CapabilityRouteState back={back} kind="notFound" />;
  }
  if ((product.isError && !product.data) || (movements.isError && !movements.data)) {
    return (
      <CapabilityRouteState
        back={back}
        kind="error"
        onRetry={() => {
          void product.refetch();
          void movements.refetch();
        }}
      />
    );
  }
  if (!product.data || !movement) {
    return (
      <CapabilityRouteState back={back} kind="error" onRetry={() => void movements.refetch()} />
    );
  }
  if (
    product.data.product.status !== "active" ||
    !product.data.product.tracked ||
    product.data.stock === null ||
    movement.action === "reverse" ||
    movement.reversedByMovementId !== null
  ) {
    return <CapabilityRouteState back={back} kind="unavailable" />;
  }
  if (initializedBusiness !== business.id) return <CapabilityRouteState kind="loading" />;

  const prepareReview = () => {
    const result = buildReversalCommand({ draft, idempotencyKey: Crypto.randomUUID() });
    if ("errors" in result) {
      setErrors(localizedErrors(result.errors));
      return;
    }
    setErrors({});
    setCommand(result.command);
    mutation.reset();
  };
  const confirm = () => {
    if (command) mutation.mutate(command);
  };
  const mutationState = mutationUiState({ error: mutation.error, isPending: mutation.isPending });

  return (
    <ReversalEditor
      command={command}
      copy={catalogInventoryCopy.reversal}
      draft={draft}
      errors={errors}
      movement={movement}
      mutationMessage={
        mutation.error ? mutationErrorMessage(mutation.error, "reversal") : undefined
      }
      mutationState={mutationState}
      onBack={back.onPress}
      onCancelReview={() => {
        if (mutationState === "uncertain") return;
        setCommand(null);
        mutation.reset();
      }}
      onConfirm={confirm}
      onDraftChange={(nextDraft) => {
        setDraft(nextDraft);
        setErrors({});
      }}
      onResolveUncertain={confirm}
      onReview={prepareReview}
      productName={product.data.product.name}
      timeZone={business.timeZone}
    />
  );
}
