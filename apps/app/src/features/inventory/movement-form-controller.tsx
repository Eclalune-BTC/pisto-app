import type { RecordInventoryMovementRequest } from "@pisto/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { Link, Redirect, useRouter } from "expo-router";
import type { TFunction } from "i18next";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TextInput } from "react-native";
import type { DescriptionItem } from "@/components/layout/description-list";
import { ChangedValue } from "@/components/layout/review-values";
import { RouteState } from "@/components/route-state";
import { useRouteLabel } from "@/components/shell/shell-context";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { formatLocalMoment } from "@/i18n/format";
import { requireSupportedLocale } from "@/i18n/locale";
import { useKeyedCommand } from "@/lib/keyed-command";
import { currentLocalDateTime } from "@/lib/money";
import { isLockedPhase } from "@/lib/mutation-phase";
import { notify } from "@/lib/notify";
import { productErrorMessage } from "@/lib/product-errors";
import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";
import { quantityText, signedQuantityText } from "../catalog/format";
import { invalidateCatalogInventory, productQueryOptions } from "../catalog/queries";
import { hasStaleRead, readState } from "../catalog/state";
import { inventoryApi } from "./api";
import { stockHref } from "./inventory-screen";
import {
  balanceAfter,
  buildMovementCommand,
  type InventoryMovementDraft,
  type InventoryMovementErrors,
  type InventoryMovementField,
  movementDelta,
} from "./movement-draft";
import { type MovementFieldRefs, MovementFormScreen } from "./movement-form-screen";
import { InventoryLink } from "./product-stock-controller";

const emptyDraft: InventoryMovementDraft = {
  action: "receive",
  occurredLocalDate: "",
  occurredLocalTime: "",
  quantity: "",
  reason: "",
};

const fieldOrder: readonly InventoryMovementField[] = [
  "quantity",
  "reason",
  "occurredLocalDate",
  "occurredLocalTime",
];

function localizedErrors(
  errors: InventoryMovementErrors,
  precision: number,
  t: TFunction,
): InventoryMovementErrors {
  return {
    ...(errors.quantity
      ? {
          quantity:
            precision === 0
              ? t("inventory.movementEditor.validation.quantityWhole")
              : t("inventory.movementEditor.validation.quantity", { count: precision }),
        }
      : {}),
    ...(errors.reason
      ? {
          reason:
            errors.reason === "missing"
              ? t("inventory.movementEditor.validation.reasonMissing")
              : t("inventory.movementEditor.validation.reasonTooLong"),
        }
      : {}),
    ...(errors.occurredLocalDate
      ? { occurredLocalDate: t("inventory.movementEditor.validation.date") }
      : {}),
    ...(errors.occurredLocalTime
      ? { occurredLocalTime: t("inventory.movementEditor.validation.time") }
      : {}),
  };
}

export function MovementFormRoute({ productId }: { productId: string | undefined }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { i18n, t } = useTranslation();
  const locale = requireSupportedLocale(i18n.resolvedLanguage);
  const businesses = useQuery(businessesQueryOptions);
  const access = readState([businesses]);
  const business = access === "denied" ? undefined : getActiveBusiness(businesses.data);
  const permissions = business?.access.permissions ?? [];
  // The product, its unit and its balance come from the catalog read.
  const canManage =
    permissions.includes("inventory:manage") && permissions.includes("catalog:read");
  // The form checks an outflow against this balance, so it reads the balance afresh.
  const productQuery = useQuery({
    ...productQueryOptions(canManage ? business?.id : undefined, productId),
    refetchOnMount: "always",
  });
  const detail = productQuery.data;
  const [draft, setDraft] = useState<InventoryMovementDraft>(emptyDraft);
  const [errors, setErrors] = useState<InventoryMovementErrors>({});
  const [command, setCommand] = useState<RecordInventoryMovementRequest | null>(null);
  const [initializedBusiness, setInitializedBusiness] = useState<string | null>(null);
  // Each ref is its own top-level hook call: the compiler memoizes object literals, and a hook
  // inside a memoized literal would run on the first render only.
  const quantityRef = useRef<TextInput>(null);
  const reasonRef = useRef<TextInput>(null);
  const dateRef = useRef<TextInput | HTMLInputElement>(null);
  const timeRef = useRef<TextInput | HTMLInputElement>(null);
  const fieldRefs: MovementFieldRefs = {
    occurredLocalDate: dateRef,
    occurredLocalTime: timeRef,
    quantity: quantityRef,
    reason: reasonRef,
  };
  // A rejected draft moves focus to the first field to fix.
  const pendingFocus = useRef<InventoryMovementField | null>(null);
  useEffect(() => {
    const target = pendingFocus.current;
    pendingFocus.current = null;
    if (target) fieldRefs[target].current?.focus();
  });
  // A rejected read takes the cached product name out of the breadcrumb too.
  useRouteLabel(
    "/operate/inventory/[productId]",
    readState([businesses, productQuery]) === "denied" ? undefined : detail?.product.name,
  );

  // A new movement starts at the business's current local moment, once; clearing a field later
  // must not refill it while the person is editing.
  if (business && initializedBusiness !== business.id) {
    setInitializedBusiness(business.id);
    const now = currentLocalDateTime(business.timeZone);
    setDraft((value) => ({ ...value, occurredLocalDate: now.date, occurredLocalTime: now.time }));
  }

  const mutation = useKeyedCommand({
    mutationFn: (input: RecordInventoryMovementRequest) => {
      if (!productId) throw new Error("The product identifier is missing");
      return inventoryApi.recordMovement(productId, input);
    },
    onConfirmed: async ({ movement }) => {
      if (business) await invalidateCatalogInventory(queryClient, business.id);
      notify.success(t("inventory.movementEditor.recorded"), {
        description: detail
          ? `${t(`inventory.movementActions.${movement.action}`)} · ${signedQuantityText(
              t,
              locale,
              {
                deltaMinorUnits: movement.deltaMinorUnits,
                precision: movement.quantityPrecision,
                unitKind: detail.product.unitKind,
              },
            )}`
          : undefined,
      });
      router.replace(stockHref(movement.productId));
    },
  });
  const { phase } = mutation;
  const locked = isLockedPhase(phase);

  if (access === "offline") return <RouteState kind="offline" width="form" />;
  if (access === "loading") {
    return <RouteState kind="loading" variant="form" width="form" />;
  }
  if (access === "error" || access === "notFound") {
    return <RouteState kind="error" onRetry={() => void businesses.refetch()} width="form" />;
  }
  if (access === "ready" && !business) return <Redirect href="/business" />;
  if (!business || !canManage || readState([productQuery]) === "denied") {
    return <RouteState kind="denied" width="form" />;
  }
  const read = readState([productQuery]);
  if (!productId || read === "notFound") {
    return (
      <RouteState
        action={<InventoryLink />}
        description={t("inventory.product.notFoundDescription")}
        kind="notFound"
        title={t("inventory.product.notFoundTitle")}
        width="form"
      />
    );
  }
  if (read === "offline") return <RouteState kind="offline" width="form" />;
  if (read === "error") {
    return <RouteState kind="error" onRetry={() => void productQuery.refetch()} width="form" />;
  }
  if (!detail || initializedBusiness !== business.id) {
    return <RouteState kind="loading" variant="form" width="form" />;
  }
  const { product, stock } = detail;
  // A reviewed command keeps its screen: an uncertain one must stay resendable with its key.
  if (!stock || (product.status !== "active" && !command)) {
    return (
      <RouteState
        action={
          <Link asChild href={stock ? stockHref(product.id) : "/operate/inventory"}>
            <Button accessibilityRole="link" size="sm" variant="outline">
              <Text>
                {stock
                  ? t("inventory.movementEditor.viewStock")
                  : t("inventory.product.goToInventory")}
              </Text>
            </Button>
          </Link>
        }
        description={
          stock
            ? t("inventory.product.archivedDescription")
            : t("inventory.product.notTrackedDescription")
        }
        kind="unavailable"
        title={stock ? undefined : t("inventory.product.notTrackedTitle")}
        width="form"
      />
    );
  }

  const isStale = hasStaleRead([businesses, productQuery]);
  const quantity = (minorUnits: string) =>
    quantityText(t, locale, {
      minorUnits,
      precision: stock.quantityPrecision,
      unitKind: product.unitKind,
    });
  const onHand = quantity(stock.onHandMinorUnits);

  const prepareReview = () => {
    if (isStale || locked || command) return;
    const result = buildMovementCommand({
      draft,
      idempotencyKey: Crypto.randomUUID(),
      quantityPrecision: product.quantityPrecision,
    });
    if ("errors" in result) {
      setErrors(localizedErrors(result.errors, product.quantityPrecision, t));
      pendingFocus.current = fieldOrder.find((field) => result.errors[field]) ?? null;
      return;
    }
    // The server refuses a negative balance under its lock; this catches it before the review.
    if (balanceAfter(stock.onHandMinorUnits, result.command) < 0n) {
      setErrors({ quantity: t("inventory.movementEditor.validation.insufficient", { onHand }) });
      pendingFocus.current = "quantity";
      return;
    }
    setErrors({});
    setCommand(result.command);
    mutation.reset();
  };

  const reviewItems: DescriptionItem[] | null = command
    ? [
        { label: t("inventory.movementEditor.product"), value: product.name },
        {
          label: t("inventory.movementEditor.actionLabel"),
          value: t(`inventory.movementActions.${command.action}`),
        },
        {
          label: t("inventory.movementEditor.quantity"),
          numeric: true,
          value: signedQuantityText(t, locale, {
            deltaMinorUnits: movementDelta(command),
            precision: stock.quantityPrecision,
            unitKind: product.unitKind,
          }),
        },
        {
          label: t("inventory.movementEditor.stockChange"),
          numeric: true,
          value: (
            <ChangedValue
              after={quantity(balanceAfter(stock.onHandMinorUnits, command).toString())}
              before={onHand}
              numeric
            />
          ),
        },
        { label: t("inventory.movementEditor.reason"), value: command.reason },
        {
          label: t("inventory.movementEditor.moment"),
          numeric: true,
          value: formatLocalMoment(command.occurredLocalDate, command.occurredLocalTime, locale),
        },
      ]
    : null;

  return (
    <MovementFormScreen
      draft={draft}
      errors={errors}
      fieldRefs={fieldRefs}
      isRefreshing={businesses.isFetching || productQuery.isFetching}
      isStale={isStale}
      mutationMessage={
        mutation.error
          ? productErrorMessage(
              mutation.error,
              t("productErrors.contexts.movement.fallback"),
              t,
              "movement",
            )
          : undefined
      }
      onCancel={() => {
        if (!locked) router.replace(stockHref(product.id));
      }}
      onConfirm={() => {
        if (!command || phase === "pending") return;
        // The same command may always be sent again; only a first attempt needs fresh data.
        if (phase === "uncertain" || !isStale) mutation.send(command);
      }}
      onDraftChange={(next) => {
        if (command || locked) return;
        setDraft(next);
        setErrors({});
      }}
      onEditReview={() => {
        if (locked) return;
        setCommand(null);
        mutation.reset();
        // The review that held focus is gone; the form continues at its first field.
        pendingFocus.current = "quantity";
      }}
      onHand={onHand}
      onRetryRead={() => {
        void businesses.refetch();
        void productQuery.refetch();
      }}
      onReview={prepareReview}
      phase={phase}
      productName={product.name}
      quantityPrecision={product.quantityPrecision}
      reviewItems={reviewItems}
    />
  );
}
