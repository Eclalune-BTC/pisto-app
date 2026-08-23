import type { Business } from "@pisto/contracts";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { ArrowLeft } from "lucide-react-native";
import { useDeferredValue, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Page } from "@/components/page";
import { ScreenHeader } from "@/components/screen-header";
import { Button, ButtonText } from "@/components/ui/button";
import { customersReceivablesCopy as copy } from "@/features/customers/copy";
import { CustomerPicker } from "@/features/customers/customer-picker";
import { customerDetailQueryOptions, customersQueryOptions } from "@/features/customers/queries";
import { DEFAULT_LOCALE } from "@/i18n/locale";
import { currentLocalDateTime, formatMinorUnits } from "@/lib/money";
import type {
  Customer,
  PostReceivableRequest,
} from "../../../../../packages/contracts/src/receivables";

import { receivablesApi } from "./api";
import {
  buildPostReceivableCommand,
  type PostReceivableDraft,
  type ReceivableDraftIssue,
} from "./draft";
import { financialMutationState, invalidateReceivableMutation } from "./mutation-state";
import { amountInputPlaceholder } from "./presentation";
import { ReceivableForm } from "./receivable-form";
import { PostReceivableReview } from "./receivable-reviews";

type ReceivableEditorProps = {
  business: Business;
  initialCustomerId?: string;
  onBack: () => void;
  onConfirmed: (receivableId: string) => void;
};

type DraftErrors = Partial<
  Record<"amount" | "customer" | "description" | "dueDate" | "postedDate", string>
>;

type SelectionSource = "initial" | "list" | null;

function issueMessage(issue: ReceivableDraftIssue | undefined): string | undefined {
  if (!issue) return undefined;
  const validation = copy.receivables.validation;
  if (issue === "customer") return validation.customer;
  if (issue === "description") return validation.description;
  if (issue === "due-date") return validation.dueDate;
  if (issue === "date") return validation.date;
  return validation.amount;
}

export function ReceivableEditor({
  business,
  initialCustomerId,
  onBack,
  onConfirmed,
}: ReceivableEditorProps) {
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? DEFAULT_LOCALE;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectionSource, setSelectionSource] = useState<SelectionSource>(null);
  const [draft, setDraft] = useState<PostReceivableDraft>(() => ({
    amount: "",
    description: "",
    dueDate: "",
    postedDate: currentLocalDateTime(business.timeZone).date,
  }));
  const [errors, setErrors] = useState<DraftErrors>({});
  const [command, setCommand] = useState<PostReceivableRequest | null>(null);
  const customers = useInfiniteQuery(
    customersQueryOptions(business.id, {
      query: deferredSearch || undefined,
      status: "active",
    }),
  );
  const initialCustomer = useQuery({
    ...customerDetailQueryOptions(business.id, initialCustomerId ?? "missing-customer"),
    enabled: Boolean(initialCustomerId),
  });

  useEffect(() => {
    if (
      !selectedCustomer &&
      !initialCustomer.isError &&
      initialCustomer.data?.customer.status === "active"
    ) {
      setSelectedCustomer(initialCustomer.data.customer);
      setSelectionSource("initial");
    }
  }, [initialCustomer.data, initialCustomer.isError, selectedCustomer]);

  const mutation = useMutation({
    mutationFn: receivablesApi.post,
    onSuccess: async ({ receivable }) => {
      await invalidateReceivableMutation(queryClient, {
        businessId: business.id,
        customerId: receivable.customerId,
        receivableId: receivable.id,
      });
      onConfirmed(receivable.id);
    },
  });

  const selectionReadFailed =
    selectionSource === "initial"
      ? initialCustomer.isError || initialCustomer.fetchStatus === "paused"
      : selectionSource === "list"
        ? customers.isError || customers.fetchStatus === "paused"
        : false;

  const prepareReview = () => {
    if (selectionReadFailed) {
      setErrors((current) => ({
        ...current,
        customer: copy.common.unavailableDescription,
      }));
      return;
    }
    const result = buildPostReceivableCommand(
      draft,
      selectedCustomer,
      business.currencyMinorUnitDigits,
      Crypto.randomUUID(),
    );
    setErrors({
      amount: issueMessage(result.issues.amount),
      customer: issueMessage(result.issues.customer),
      description: issueMessage(result.issues.description),
      dueDate: issueMessage(result.issues.dueDate),
      postedDate: issueMessage(result.issues.postedDate),
    });
    if (!("command" in result)) return;
    setCommand(result.command);
    mutation.reset();
  };

  if (pickerOpen) {
    const items = customers.data?.pages.flatMap((page) => page.items) ?? [];
    return (
      <Page width="form">
        <CustomerPicker
          hasNextPage={Boolean(customers.hasNextPage)}
          isError={customers.isError}
          isLoading={customers.isPending && customers.fetchStatus !== "paused"}
          isLoadingMore={customers.isFetchingNextPage}
          isOffline={customers.fetchStatus === "paused"}
          items={items}
          onBack={() => setPickerOpen(false)}
          onLoadMore={() => customers.fetchNextPage()}
          onRetry={() => customers.refetch()}
          onSearchChange={setSearch}
          onSelect={(customer) => {
            setSelectedCustomer(customer);
            setSelectionSource("list");
            setErrors((current) => ({ ...current, customer: undefined }));
            setPickerOpen(false);
          }}
          search={search}
          selectedCustomerId={selectedCustomer?.id ?? null}
        />
      </Page>
    );
  }

  return (
    <Page width="form">
      <Button className="self-start px-0" onPress={onBack} variant="ghost">
        <ArrowLeft color="#237A55" size={18} />
        <ButtonText variant="ghost">{copy.common.back}</ButtonText>
      </Button>
      <ScreenHeader
        description={copy.receivables.route.newDescription}
        title={copy.receivables.route.newTitle}
      />
      {command && selectedCustomer ? (
        <PostReceivableReview
          amount={formatMinorUnits(
            command.originalMinorUnits,
            business.currency,
            business.currencyMinorUnitDigits,
            locale,
          )}
          copy={copy.receivables.review}
          customerName={selectedCustomer.name}
          description={command.description}
          dueDate={command.dueDate ?? null}
          mutation={financialMutationState(mutation)}
          onCancel={() => {
            setCommand(null);
            mutation.reset();
          }}
          onConfirm={() => mutation.mutate(command)}
          onRetrySameCommand={() => mutation.mutate(command)}
          postedDate={command.postedDate}
        />
      ) : (
        <ReceivableForm
          amount={draft.amount}
          canReview={Boolean(
            selectedCustomer && draft.amount && draft.description.trim() && !selectionReadFailed,
          )}
          copy={{
            ...copy.receivables.form,
            amountPlaceholder: amountInputPlaceholder(business.currencyMinorUnitDigits),
          }}
          description={draft.description}
          dueDate={draft.dueDate}
          errors={errors}
          onCancel={onBack}
          onChange={(field, value) => {
            setDraft((current) => ({ ...current, [field]: value }));
            setErrors((current) => ({ ...current, [field]: undefined }));
          }}
          onChooseCustomer={() => setPickerOpen(true)}
          onReview={prepareReview}
          postedDate={draft.postedDate}
          selectedCustomerName={selectedCustomer?.name ?? null}
        />
      )}
    </Page>
  );
}
