import { ArrowLeft, RotateCcw } from "lucide-react-native";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { Page } from "@/components/page";
import { ScreenHeader } from "@/components/screen-header";
import { Button, ButtonText } from "@/components/ui/button";

import type { ReceivableDetailLoadState, ReceivablesCopy } from "./types";

type ReceivableDetailScreenProps = {
  canManage: boolean;
  cashAccountNameFor: (cashAccountId: string) => string;
  copy: ReceivablesCopy;
  customerActive: boolean;
  customerName: string;
  formatDate: (date: string) => string;
  formatMoney: (minorUnits: string, currency: string, digits: number) => string;
  onApplyPayment: () => void;
  onBack: () => void;
  onRetry: () => void;
  onReversePayment: (paymentId: string) => void;
  onVoid: () => void;
  state: ReceivableDetailLoadState;
};

export function ReceivableDetailScreen({
  canManage,
  cashAccountNameFor,
  copy,
  customerActive,
  customerName,
  formatDate,
  formatMoney,
  onApplyPayment,
  onBack,
  onRetry,
  onReversePayment,
  onVoid,
  state,
}: ReceivableDetailScreenProps) {
  if (state.kind === "loading") {
    return (
      <View className="flex-1 items-start justify-center gap-3 px-5 sm:px-8 lg:px-10">
        <ActivityIndicator color="#237A55" />
        <Text className="text-sm text-ink-muted dark:text-[#AAB8B0]">{copy.loading}</Text>
      </View>
    );
  }
  if (state.kind !== "ready") {
    const title =
      state.kind === "offline"
        ? copy.offlineTitle
        : state.kind === "denied"
          ? copy.deniedTitle
          : state.kind === "notFound"
            ? copy.unavailableTitle
            : copy.errorTitle;
    const description =
      state.kind === "offline"
        ? copy.offlineDescription
        : state.kind === "denied"
          ? copy.deniedDescription
          : state.kind === "notFound"
            ? copy.unavailableDescription
            : copy.errorDescription;
    return (
      <Page>
        <Button label={copy.back} onPress={onBack} variant="ghost" />
        <View className="gap-3 border-y border-line py-8 dark:border-[#304239]">
          <Text accessibilityRole="header" className="text-xl font-black text-ink dark:text-white">
            {title}
          </Text>
          <Text className="text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
            {description}
          </Text>
          {state.kind === "error" ? (
            <Button label={copy.retry} onPress={onRetry} variant="secondary" />
          ) : null}
        </View>
      </Page>
    );
  }

  const item = state.receivable;
  const stateLabel = {
    open: copy.open,
    overdue: copy.overdue,
    paid: copy.paid,
    voided: copy.voided,
  }[item.state];
  return (
    <Page contentContainerClassName="gap-8">
      <Pressable
        accessibilityLabel={copy.back}
        accessibilityRole="button"
        className="min-h-11 flex-row items-center gap-2 self-start"
        onPress={onBack}
      >
        <ArrowLeft color="#237A55" size={18} />
        <Text className="font-bold text-positive dark:text-[#8DDEAF]">{copy.back}</Text>
      </Pressable>
      <ScreenHeader
        action={
          canManage && item.state !== "voided" ? (
            <View className="flex-row gap-2">
              {customerActive && item.outstandingMinorUnits !== "0" ? (
                <Button label={copy.applyPayment} onPress={onApplyPayment} variant="accent" />
              ) : null}
              {item.paidMinorUnits === "0" ? (
                <Button label={copy.void} onPress={onVoid} variant="ghost" />
              ) : null}
            </View>
          ) : undefined
        }
        description={`${item.description} — ${stateLabel}`}
        title={customerName}
      />
      {state.stale ? (
        <View className="border-l-4 border-warning bg-[#FFF6E8] p-3 dark:bg-[#3A2A18]">
          <Text className="text-sm text-ink dark:text-[#F2E4D2]">{copy.stale}</Text>
        </View>
      ) : null}
      <View className="gap-5 border-y border-line py-6 lg:flex-row dark:border-[#304239]">
        <View className="min-w-0 flex-1 gap-1">
          <Text className="text-xs font-bold uppercase tracking-[1px] text-ink-muted dark:text-[#91A198]">
            {copy.outstanding}
          </Text>
          <Text className="text-3xl font-black text-ink dark:text-white">
            {formatMoney(item.outstandingMinorUnits, item.currency, item.currencyMinorUnitDigits)}
          </Text>
        </View>
        <View className="min-w-0 flex-1 gap-2 border-t border-line pt-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0 dark:border-[#304239]">
          <Text className="text-sm text-ink-muted dark:text-[#AAB8B0]">
            {copy.originalAmount}:{" "}
            {formatMoney(item.originalMinorUnits, item.currency, item.currencyMinorUnitDigits)}
          </Text>
          <Text className="text-sm text-ink-muted dark:text-[#AAB8B0]">
            {copy.postedDate}: {formatDate(item.postedDate)}
          </Text>
          <Text className="text-sm text-ink-muted dark:text-[#AAB8B0]">
            {copy.dueDate}: {item.dueDate ? formatDate(item.dueDate) : copy.noDueDate}
          </Text>
        </View>
      </View>
      <View className="gap-3">
        <Text accessibilityRole="header" className="text-xl font-black text-ink dark:text-white">
          {copy.paymentHistory}
        </Text>
        {state.payments.length === 0 ? (
          <Text className="border-t border-line py-5 text-sm text-ink-muted dark:border-[#304239] dark:text-[#AAB8B0]">
            {copy.noPayments}
          </Text>
        ) : (
          <View className="border-t border-line dark:border-[#304239]">
            {state.payments.map((payment) => {
              const alreadyReversed = state.payments.some(
                (candidate) =>
                  candidate.kind === "reversal" && candidate.reversesPaymentId === payment.id,
              );
              return (
                <View
                  className="gap-3 border-b border-line py-4 sm:flex-row sm:items-center sm:justify-between dark:border-[#304239]"
                  key={payment.id}
                >
                  <View className="min-w-0 flex-1 gap-1">
                    <Text className="font-bold text-ink dark:text-white">
                      {payment.kind === "reversal" ? copy.reversedPayment : copy.applyPayment}
                    </Text>
                    <Text className="text-sm text-ink-muted dark:text-[#AAB8B0]">
                      {formatDate(payment.occurredLocalDate)}
                    </Text>
                    <Text className="text-sm text-ink-muted dark:text-[#AAB8B0]">
                      {copy.cashAccount}: {cashAccountNameFor(payment.cashAccountId)}
                    </Text>
                  </View>
                  <View className="items-start gap-2 sm:items-end">
                    <Text className="font-black text-ink dark:text-white">
                      {formatMoney(
                        payment.amountMinorUnits,
                        payment.currency,
                        payment.currencyMinorUnitDigits,
                      )}
                    </Text>
                    {canManage && payment.kind === "payment" && !alreadyReversed ? (
                      <Button
                        onPress={() => onReversePayment(payment.id)}
                        size="sm"
                        variant="ghost"
                      >
                        <RotateCcw color="#B94242" size={16} />
                        <ButtonText className="text-danger" variant="ghost">
                          {copy.reverse}
                        </ButtonText>
                      </Button>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </Page>
  );
}
