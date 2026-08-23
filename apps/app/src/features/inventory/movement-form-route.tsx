import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { Redirect, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { currentLocalDateTime } from "@/lib/money";

import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";
import type { RecordInventoryMovementRequest } from "../../../../../packages/contracts/src/catalog";
import { catalogInventoryCopy } from "../catalog/copy";
import { useProductQuery } from "../catalog/queries";
import { catalogInventoryQueryKeys } from "../catalog/query-keys";
import { CapabilityRouteState } from "../catalog/route-state";
import {
  isDeniedError,
  isNotFoundError,
  mutationErrorMessage,
  mutationUiState,
} from "../catalog/state";
import { inventoryApi } from "./api";
import { buildMovementCommand } from "./movement-draft";
import {
  type InventoryMovementDraft,
  type InventoryMovementErrors,
  MovementEditor,
} from "./movement-editor";
import { formatQuantityMinorUnits } from "./quantity";

const emptyDraft: InventoryMovementDraft = {
  action: "receive",
  occurredLocalDate: "",
  occurredLocalTime: "",
  quantity: "",
  reason: "",
};

function localizeErrors(errors: InventoryMovementErrors): InventoryMovementErrors {
  const copy = catalogInventoryCopy.movementEditor.validation;
  return {
    ...(errors.occurredLocalDate ? { occurredLocalDate: copy.date } : {}),
    ...(errors.occurredLocalTime ? { occurredLocalTime: copy.time } : {}),
    ...(errors.quantity ? { quantity: copy.quantity } : {}),
    ...(errors.reason ? { reason: copy.reason } : {}),
  };
}

export function MovementFormRoute({ productId }: { productId: string | undefined }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const businesses = useQuery(businessesQueryOptions);
  const business = getActiveBusiness(businesses.data);
  const canReadCatalog = business?.access.permissions.includes("catalog:read") ?? false;
  const canManage = business?.access.permissions.includes("inventory:manage") ?? false;
  const product = useProductQuery({
    businessId: business?.id,
    enabled: Boolean(business && canReadCatalog),
    productId,
  });
  const [draft, setDraft] = useState<InventoryMovementDraft>(emptyDraft);
  const [errors, setErrors] = useState<InventoryMovementErrors>({});
  const [command, setCommand] = useState<RecordInventoryMovementRequest | null>(null);
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

  const mutation = useMutation({
    mutationFn: (input: RecordInventoryMovementRequest) =>
      inventoryApi.recordMovement(productId as string, input),
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

  const reviewItems = useMemo(() => {
    if (!command || !business || !product.data) return null;
    const copy = catalogInventoryCopy.movementEditor;
    return [
      { label: copy.reviewFields.action, value: copy.actions[command.action] },
      {
        label: copy.reviewFields.quantity,
        value: formatQuantityMinorUnits(
          command.quantityMinorUnits,
          product.data.product.quantityPrecision,
        ),
      },
      { label: copy.reviewFields.reason, value: command.reason },
      { label: copy.reviewFields.date, value: command.occurredLocalDate },
      { label: copy.reviewFields.time, value: command.occurredLocalTime },
      { label: copy.reviewFields.timeZone, value: business.timeZone },
    ];
  }, [business, command, product.data]);

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
  if (!canManage || !canReadCatalog || isDeniedError(product.error)) {
    return <CapabilityRouteState back={back} kind="denied" />;
  }
  if (product.fetchStatus === "paused") {
    return <CapabilityRouteState back={back} kind="offline" />;
  }
  if (product.isPending) return <CapabilityRouteState kind="loading" />;
  if (!productId || isNotFoundError(product.error)) {
    return <CapabilityRouteState back={back} kind="notFound" />;
  }
  if (product.isError && !product.data) {
    return <CapabilityRouteState back={back} kind="error" onRetry={() => void product.refetch()} />;
  }
  if (
    !product.data?.product.tracked ||
    product.data.stock === null ||
    product.data.product.status !== "active"
  ) {
    return <CapabilityRouteState back={back} kind="unavailable" />;
  }
  if (initializedBusiness !== business.id) return <CapabilityRouteState kind="loading" />;

  const prepareReview = () => {
    const result = buildMovementCommand({
      draft,
      idempotencyKey: Crypto.randomUUID(),
      quantityPrecision: product.data.product.quantityPrecision,
    });
    if ("errors" in result) {
      setErrors(localizeErrors(result.errors));
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
    <MovementEditor
      copy={catalogInventoryCopy.movementEditor}
      draft={draft}
      errors={errors}
      mutationMessage={
        mutation.error ? mutationErrorMessage(mutation.error, "movement") : undefined
      }
      mutationState={mutationState}
      onBack={back.onPress}
      onConfirm={confirm}
      onDraftChange={(nextDraft) => {
        setDraft(nextDraft);
        setErrors({});
      }}
      onEditReview={() => {
        if (mutationState === "uncertain") return;
        setCommand(null);
        mutation.reset();
      }}
      onResolveUncertain={confirm}
      onReview={prepareReview}
      productName={product.data.product.name}
      quantityPrecision={product.data.product.quantityPrecision}
      reviewItems={reviewItems}
    />
  );
}
