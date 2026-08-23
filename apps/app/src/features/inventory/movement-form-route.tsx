import type { RecordInventoryMovementRequest } from "@pisto/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { Redirect, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { currentLocalDateTime } from "@/lib/money";
import { productErrorMessage } from "@/lib/product-errors";
import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";
import { buildCatalogCopy, type CatalogCopy } from "../catalog/copy";
import { useProductQuery } from "../catalog/queries";
import { catalogInventoryQueryKeys } from "../catalog/query-keys";
import { CapabilityRouteState } from "../catalog/route-state";
import { isDeniedError, isNotFoundError, mutationUiState } from "../catalog/state";
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

function localizeErrors(
  errors: InventoryMovementErrors,
  copy: CatalogCopy["movementValidation"],
): InventoryMovementErrors {
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
  const { t } = useTranslation();
  const copy = useMemo(() => buildCatalogCopy(t), [t]);
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
    const fieldCopy = copy.movementEditorFields;
    return [
      { label: fieldCopy.action, value: copy.movementEditor.actions[command.action] },
      {
        label: fieldCopy.quantity,
        value: formatQuantityMinorUnits(
          command.quantityMinorUnits,
          product.data.product.quantityPrecision,
        ),
      },
      { label: fieldCopy.reason, value: command.reason },
      { label: fieldCopy.date, value: command.occurredLocalDate },
      { label: fieldCopy.time, value: command.occurredLocalTime },
      { label: fieldCopy.timeZone, value: business.timeZone },
    ];
  }, [business, command, copy, product.data]);

  const back = {
    label: copy.remote.backToInventory,
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
      setErrors(localizeErrors(result.errors, copy.movementValidation));
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
      copy={copy.movementEditor}
      draft={draft}
      errors={errors}
      mutationMessage={
        mutation.error
          ? productErrorMessage(mutation.error, copy.errorFallbacks.movement, t, "movement")
          : undefined
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
