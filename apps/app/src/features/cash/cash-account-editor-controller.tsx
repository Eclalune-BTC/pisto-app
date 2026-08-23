import type { CreateCashAccountRequest, UpdateCashAccountRequest } from "@pisto/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { Redirect, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { DEFAULT_LOCALE } from "@/i18n/locale";
import { currentLocalDateTime } from "@/lib/money";
import { cashApi } from "./api";
import {
  type CashAccountEditorDraft,
  type CashAccountEditorErrors,
  CashAccountEditorScreen,
} from "./cash-account-editor-screen";
import {
  cashAccountEditorCopy,
  cashErrorMessage,
  cashIssueMessage,
  cashKindOptions,
  cashUiCopy,
} from "./copy";
import { buildCashAccountCommand } from "./drafts";
import { formatCashMinorUnits } from "./format";
import { invalidateCashLedger } from "./invalidate";
import { cashConfirmationState } from "./mutation-state";
import { cashAccountQueryOptions } from "./queries";
import { featureRemoteState, queryHasStaleData } from "./remote-state";
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

type CashAccountEditorControllerProps = {
  accountId?: string;
  mode: "create" | "update";
};

export function CashAccountEditorController({ accountId, mode }: CashAccountEditorControllerProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    business,
    businesses,
    canManage,
    canRead,
    isStale: accessIsStale,
  } = useCashAccess("cash");
  const businessId = business?.id ?? "unselected";
  const accountQuery = useQuery({
    ...cashAccountQueryOptions(businessId, accountId ?? "missing"),
    enabled: Boolean(mode === "update" && accountId && business && canRead),
  });
  const account = mode === "update" ? (accountQuery.data?.account ?? null) : null;
  const [draft, setDraft] = useState<CashAccountEditorDraft>(emptyDraft);
  const [errors, setErrors] = useState<CashAccountEditorErrors>({});
  const [command, setCommand] = useState<
    CreateCashAccountRequest | UpdateCashAccountRequest | null
  >(null);
  const initializedAccount = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!business || draft.openingLocalDate || draft.openingLocalTime) return;
    const current = currentLocalDateTime(business.timeZone);
    setDraft((value) => ({
      ...value,
      openingLocalDate: current.date,
      openingLocalTime: current.time,
    }));
  }, [business, draft.openingLocalDate, draft.openingLocalTime]);

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
    mutationFn: (nextCommand: CreateCashAccountRequest | UpdateCashAccountRequest) => {
      if (mode === "create")
        return cashApi.accounts.create(nextCommand as CreateCashAccountRequest);
      if (!accountId) throw new Error("Cash account identifier is missing");
      return cashApi.accounts.update(accountId, nextCommand as UpdateCashAccountRequest);
    },
    onSuccess: async ({ account: savedAccount }) => {
      if (!business) return;
      await invalidateCashLedger(queryClient, business.id);
      router.replace({
        pathname: "/operate/cash/accounts/[accountId]",
        params: { accountId: savedAccount.id },
      });
    },
  });

  if (businesses.data && !business) return <Redirect href="/business" />;

  let remoteState = featureRemoteState({
    businessPending: businesses.isPending,
    canRead,
    offlineMessage: cashUiCopy.offline,
    queries: [businesses, ...(canRead && mode === "update" ? [accountQuery] : [])],
    unavailableMessage: cashUiCopy.unavailable,
  });
  const stale = accessIsStale || (mode === "update" && queryHasStaleData(accountQuery));
  if (remoteState.kind === "ready" && stale) {
    remoteState = { kind: "error", message: cashUiCopy.staleMutation };
  }

  const prepareReview = () => {
    if (!business) return;
    const result = buildCashAccountCommand({
      account,
      currency: business.currency,
      currencyMinorUnitDigits: business.currencyMinorUnitDigits,
      draft,
      idempotencyKey: Crypto.randomUUID(),
      mode,
    });
    setErrors(
      Object.fromEntries(
        Object.entries(result.issues).map(([field, issue]) => [field, cashIssueMessage(issue)]),
      ) as CashAccountEditorErrors,
    );
    if (!result.command) return;
    setCommand(result.command);
    mutation.reset();
  };

  const cancel = () => {
    if (accountId) {
      router.replace({ pathname: "/operate/cash/accounts/[accountId]", params: { accountId } });
    } else {
      router.replace("/operate/cash");
    }
  };

  return (
    <CashAccountEditorScreen
      account={account}
      canManage={canManage && !stale}
      command={command}
      confirmation={cashConfirmationState(mutation)}
      copy={cashAccountEditorCopy}
      currency={business?.currency ?? ""}
      draft={draft}
      effect={mode === "create" ? cashUiCopy.createAccountEffect : cashUiCopy.editAccountEffect}
      errorMessage={mutation.error ? cashErrorMessage(mutation.error) : undefined}
      errors={errors}
      formatMoney={(minorUnits, currency) =>
        formatCashMinorUnits(
          minorUnits,
          currency,
          business?.currencyMinorUnitDigits ?? 2,
          DEFAULT_LOCALE,
        )
      }
      kindOptions={cashKindOptions}
      mode={mode}
      onCancel={cancel}
      onCheckStatus={() => command && mutation.mutate(command)}
      onConfirm={() => command && mutation.mutate(command)}
      onDraftChange={setDraft}
      onEdit={() => {
        setCommand(null);
        mutation.reset();
      }}
      onPrepareReview={prepareReview}
      onRetry={() => void Promise.all([businesses.refetch(), accountQuery.refetch()])}
      remoteState={remoteState}
      stage={command ? "review" : "edit"}
    />
  );
}
