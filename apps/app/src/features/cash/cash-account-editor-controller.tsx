import type { CreateCashAccountRequest, UpdateCashAccountRequest } from "@pisto/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { Redirect, useRouter } from "expo-router";
import { SearchX } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FeatureBoundary, requireFeatureManageAccess } from "@/components/feature-boundary";
import { ContentSkeleton } from "@/components/layout/skeletons";
import { Page } from "@/components/page";
import { useRouteLabel } from "@/components/shell/shell-context";
import { StatePanel } from "@/components/ui/state-panel";
import { requireSupportedLocale } from "@/i18n/locale";
import { ApiClientError } from "@/lib/api-error";
import { currentLocalDateTime, formatMinorUnits } from "@/lib/money";
import { notify } from "@/lib/notify";
import { productErrorMessage } from "@/lib/product-errors";
import { queryHasStaleData } from "@/lib/query-state";
import { cashApi } from "./api";
import {
  type CashAccountEditorDraft,
  type CashAccountEditorErrors,
  CashAccountEditorScreen,
} from "./cash-account-editor-screen";
import { accountHref } from "./cash-account-list";
import { cashBoundaryCopy, cashIssueMessages } from "./copy";
import { buildCashAccountCommand } from "./drafts";
import { invalidateCashLedger } from "./invalidate";
import { isLockedPhase, mutationPhase } from "./mutation-state";
import { cashAccountQueryOptions } from "./queries";
import { featureRemoteState, refetchEnabled } from "./remote-state";
import { useCashAccess } from "./use-cash-access";

const emptyDraft: CashAccountEditorDraft = {
  kind: "cash",
  name: "",
  negativePolicy: "protected",
  openingAmount: "",
  openingLocalDate: "",
  openingLocalTime: "",
  openingMode: "zero",
  openingReason: "",
};

type AccountCommand = CreateCashAccountRequest | UpdateCashAccountRequest;

type CashAccountEditorControllerProps = {
  accountId?: string;
  mode: "create" | "update";
};

export function CashAccountEditorController({ accountId, mode }: CashAccountEditorControllerProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { i18n, t } = useTranslation();
  const locale = requireSupportedLocale(i18n.resolvedLanguage);
  const access = useCashAccess("cash");
  const { business, businesses, canRead } = access;
  const updating = mode === "update";
  const accountQuery = useQuery(
    cashAccountQueryOptions(updating && canRead ? business?.id : undefined, accountId),
  );
  const account = updating ? (accountQuery.data?.account ?? null) : null;
  const [draft, setDraft] = useState<CashAccountEditorDraft>(emptyDraft);
  const [errors, setErrors] = useState<CashAccountEditorErrors>({});
  const [command, setCommand] = useState<AccountCommand | null>(null);
  const initializedAccount = useRef<string | undefined>(undefined);
  useRouteLabel("/operate/cash/accounts/[accountId]", account?.name);

  useEffect(() => {
    if (!business) return;
    const now = currentLocalDateTime(business.timeZone);
    setDraft((value) => ({
      ...value,
      openingLocalDate: value.openingLocalDate || now.date,
      openingLocalTime: value.openingLocalTime || now.time,
    }));
  }, [business]);

  useEffect(() => {
    if (!account || initializedAccount.current === account.id) return;
    initializedAccount.current = account.id;
    setDraft((value) => ({
      ...value,
      kind: account.kind,
      name: account.name,
      negativePolicy: account.allowNegativeBalance ? "allowed" : "protected",
    }));
  }, [account]);

  const mutation = useMutation({
    mutationFn: (next: AccountCommand) => {
      if (!updating) return cashApi.accounts.create(next as CreateCashAccountRequest);
      if (!accountId) throw new Error("Cash account identifier is missing");
      return cashApi.accounts.update(accountId, next as UpdateCashAccountRequest);
    },
    onSuccess: async ({ account: saved }) => {
      if (business) await invalidateCashLedger(queryClient, business.id);
      notify.success(updating ? t("cash.accountEditor.updated") : t("cash.accountEditor.created"));
      router.replace(accountHref(saved.id));
    },
  });

  if (businesses.data && !business) return <Redirect href="/business" />;

  const notFound =
    updating &&
    (!accountId ||
      (accountQuery.error instanceof ApiClientError &&
        accountQuery.error.code === "NOT_FOUND" &&
        !accountQuery.data));
  const stale = access.isStale || (updating && queryHasStaleData(accountQuery));
  let state = featureRemoteState({
    businessPending: businesses.isPending,
    canRead,
    offlineMessage: t("remote.offlineLoad"),
    queries: [businesses, ...(updating && !notFound ? [accountQuery] : [])],
    unavailableMessage: t("cash.remote.unavailable"),
  });
  if (state.kind === "ready" && stale)
    state = { kind: "error", message: t("remote.staleMutation") };
  state = requireFeatureManageAccess(state, access.canManage);
  const retry = () => void refetchEnabled([businesses, accountQuery]);

  if (state.kind === "loading") {
    return (
      <Page width="form">
        <ContentSkeleton label={t("cash.boundary.loading")} variant="form" />
      </Page>
    );
  }
  if (state.kind !== "ready") {
    return (
      <FeatureBoundary copy={cashBoundaryCopy(t)} onRetry={retry} state={state}>
        {null}
      </FeatureBoundary>
    );
  }
  if (notFound) {
    return (
      <Page width="form">
        <StatePanel
          description={t("cash.accountDetail.notFoundDescription")}
          icon={SearchX}
          level={1}
          title={t("cash.accountDetail.notFoundTitle")}
        />
      </Page>
    );
  }
  if (!business) throw new Error("A cash account form requires the active business");

  const phase = mutationPhase(mutation);
  const locked = isLockedPhase(phase);

  return (
    <CashAccountEditorScreen
      account={account}
      canConfirm={access.canManage && !stale}
      command={command}
      currency={business.currency}
      draft={draft}
      errorMessage={
        mutation.error
          ? productErrorMessage(mutation.error, t("cash.remote.mutationFallback"), t)
          : undefined
      }
      errors={errors}
      formatMoney={(minorUnits, currency) =>
        formatMinorUnits(minorUnits, currency, business.currencyMinorUnitDigits, locale)
      }
      onCancel={() =>
        router.replace(updating && accountId ? accountHref(accountId) : "/operate/cash")
      }
      onConfirm={() => {
        const canConfirm = access.canManage && !stale;
        if (command && (phase === "uncertain" || (phase !== "pending" && canConfirm))) {
          mutation.mutate(command);
        }
      }}
      onDraftChange={(next) => {
        if (!command) setDraft(next);
      }}
      onEdit={() => {
        if (locked) return;
        setCommand(null);
        mutation.reset();
      }}
      onPrepareReview={() => {
        if (command) return;
        const result = buildCashAccountCommand({
          account,
          currency: business.currency,
          currencyMinorUnitDigits: business.currencyMinorUnitDigits,
          draft,
          idempotencyKey: Crypto.randomUUID(),
          mode,
        });
        setErrors(cashIssueMessages(t, result.issues));
        if (!result.command) return;
        setCommand(result.command);
        mutation.reset();
      }}
      phase={phase}
    />
  );
}
