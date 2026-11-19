import type { CatalogReply, CatalogTurnResponse, ProductDetail } from "@pisto/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ArrowLeft, ArrowUpRight, PackageSearch, Send, TriangleAlert } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DialogDescription } from "@/components/ui/dialog";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { productPrice, quantityText } from "@/features/catalog/format";
import { productQueryOptions } from "@/features/catalog/queries";
import { ProductSearch } from "@/features/sales/itemized/product-search";
import { requireSupportedLocale } from "@/i18n/locale";
import { formatMinorUnits } from "@/lib/money";
import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";
import { isAccessDeniedError, readFailureKind } from "@/lib/query-state";
import { assistantApi } from "./api";
import { assistantProblem, problemMessageKeys } from "./problems";

type ConversationProps = {
  businessId: string;
  canSell: boolean;
  initialSearch: string;
  question?: string;
  onBack: () => void;
  onClose: () => void;
};
type Quote = Extract<CatalogReply, { quantity: string }>;
type Answer = { id: number; text: string; initial: boolean; result: CatalogTurnResponse["data"] };

export function CatalogConversation({
  businessId,
  canSell,
  initialSearch,
  question,
  onBack,
  onClose,
}: ConversationProps) {
  const { t } = useTranslation();
  const [selection, setSelection] = useState<{ id: string; question?: string } | null>(null);
  const [search, setSearch] = useState(initialSearch);
  const choose = useCallback(
    (detail: ProductDetail, term = search) => {
      setSelection({
        id: detail.product.id,
        question: term && term === initialSearch ? question : undefined,
      });
    },
    [initialSearch, question, search],
  );
  if (selection)
    return (
      <ProductThread
        key={JSON.stringify([businessId, selection.id])}
        businessId={businessId}
        productId={selection.id}
        question={selection.question}
        canSell={canSell}
        onClose={onClose}
        onSearch={() => {
          setSearch("");
          setSelection(null);
        }}
      />
    );
  return (
    <View className="gap-3">
      <Heading level={2} size="page">
        {t("assistant.tools.catalog")}
      </Heading>
      <DialogDescription>{t("assistant.chat.pick")}</DialogDescription>
      <ProductSearch
        businessId={businessId}
        disabled={false}
        initialSearch={search}
        viewOnly
        onResolveInitial={choose}
        onAdd={choose}
      />
      <Button className="self-start" size="sm" variant="outline" onPress={onBack}>
        <Icon as={ArrowLeft} size={14} />
        <Text>{t("assistant.tools.menu")}</Text>
      </Button>
    </View>
  );
}

function AnswerText({ result, canSell }: { result: Answer["result"]; canSell: boolean }) {
  const { t, i18n } = useTranslation();
  const locale = requireSupportedLocale(i18n.resolvedLanguage);
  const { reply, product, stock } = result;
  let text: string;
  if (
    "quantity" in reply &&
    product.sellingPriceCurrency !== null &&
    product.sellingPriceCurrencyMinorUnitDigits !== null
  ) {
    const count = quantityText(t, locale, {
      minorUnits: reply.quantityMinorUnits,
      precision: product.quantityPrecision,
      unitKind: product.unitKind,
    });
    const total = formatMinorUnits(
      reply.totalMinorUnits,
      product.sellingPriceCurrency,
      product.sellingPriceCurrencyMinorUnitDigits,
      locale,
    );
    text = t(
      reply.kind === "prepare_sale"
        ? "assistant.chat.prepared"
        : canSell
          ? "assistant.chat.offer"
          : "assistant.chat.quote",
      { countText: count, total },
    );
  } else if (reply.kind === "price") {
    const price = productPrice(product, locale);
    text = price ? t("assistant.chat.unitPrice", { price }) : t("assistant.chat.missingPrice");
  } else if (reply.kind === "stock") {
    text = stock
      ? t("assistant.chat.stock", {
          quantity: quantityText(t, locale, {
            minorUnits: stock.onHandMinorUnits,
            precision: stock.quantityPrecision,
            unitKind: product.unitKind,
          }),
        })
      : t("assistant.chat.untracked");
  } else
    text = t(
      reply.kind === "quantity_needed"
        ? "assistant.chat.quantityNeeded"
        : reply.kind === "missing_price"
          ? "assistant.chat.missingPrice"
          : "assistant.chat.clarify",
    );
  return <Text className="font-ui text-base leading-6">{text}</Text>;
}

function ProductThread({
  businessId,
  productId,
  question,
  canSell,
  onSearch,
  onClose,
}: Pick<ConversationProps, "businessId" | "question" | "canSell" | "onClose"> & {
  productId: string;
  onSearch: () => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = requireSupportedLocale(i18n.resolvedLanguage);
  const router = useRouter();
  const client = useQueryClient();
  const detail = useQuery({
    ...productQueryOptions(businessId, productId),
    refetchOnMount: "always",
  });
  const [turns, setTurns] = useState<Answer[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  const initialStarted = useRef(false);
  useEffect(
    () => () => {
      activeRequest.current?.abort();
      activeRequest.current = null;
      initialStarted.current = false;
    },
    [],
  );
  const product = detail.data?.product;
  const price = product ? productPrice(product, locale) : null;
  const chooseAnother = (
    <Button className="self-start" size="sm" variant="ghost" onPress={onSearch}>
      <Icon as={PackageSearch} size={15} />
      <Text>{t("assistant.chat.change")}</Text>
    </Button>
  );
  const permitted = useCallback(
    (sale = false) => {
      const active = getActiveBusiness(client.getQueryData(businessesQueryOptions.queryKey));
      return (
        active?.id === businessId &&
        !isAccessDeniedError(client.getQueryState(businessesQueryOptions.queryKey)?.error) &&
        active.access.permissions.includes("assistant:use") &&
        active.access.permissions.includes("catalog:read") &&
        (!sale || active.access.permissions.includes("sales:create"))
      );
    },
    [businessId, client],
  );
  const send = useCallback(
    async (sentence: string, previousQuantity: string | null, initial = false) => {
      if (!sentence || activeRequest.current) return;
      if (!permitted()) {
        setUnavailable(true);
        return;
      }
      const controller = new AbortController();
      activeRequest.current = controller;
      setBusy(true);
      setMessage(null);
      try {
        const result = await assistantApi.catalogTurn(
          { text: sentence, expectedBusinessId: businessId, productId, previousQuantity },
          controller.signal,
        );
        if (controller.signal.aborted) return;
        if (
          !permitted() ||
          result.businessId !== businessId ||
          result.product.id !== productId ||
          result.product.status !== "active"
        ) {
          setUnavailable(true);
          return;
        }
        const id = ++sequence.current;
        setTurns((old) => [...old.slice(-3), { id, text: sentence, initial, result }]);
        const reply = result.reply;
        if ("quantity" in reply) setQuote(reply);
        else if (reply.kind !== "stock" && reply.kind !== "price") setQuote(null);
        setText("");
        client.setQueryData(productQueryOptions(businessId, productId).queryKey, {
          businessId,
          product: result.product,
          stock: result.stock,
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        if (isAccessDeniedError(error) || readFailureKind(error) === "notFound") {
          setUnavailable(true);
          return;
        }
        setMessage(t(problemMessageKeys[assistantProblem(error)]));
        if (initial) setText(sentence);
      } finally {
        if (!controller.signal.aborted) setBusy(false);
        if (activeRequest.current === controller) activeRequest.current = null;
      }
    },
    [businessId, client, permitted, productId, t],
  );
  const invalid =
    unavailable ||
    detail.isError ||
    detail.fetchStatus === "paused" ||
    (product && (product.status !== "active" || detail.data?.businessId !== businessId));
  const ready = Boolean(product && detail.isFetchedAfterMount && !invalid);
  useEffect(() => {
    if (ready && question && !initialStarted.current) {
      initialStarted.current = true;
      void send(question, null, true);
    }
  }, [question, ready, send]);
  if (invalid) {
    return (
      <View className="gap-3">
        <Alert icon={TriangleAlert} variant="warning">
          <AlertDescription>{t("assistant.chat.unavailable")}</AlertDescription>
        </Alert>
        {chooseAnother}
      </View>
    );
  }
  if (!product || !ready) return <Skeleton className="h-28 w-full rounded-lg" />;
  function submit() {
    return send(text.trim(), quote?.quantity ?? null);
  }
  function openSale() {
    if (!permitted(true)) {
      setUnavailable(true);
      return;
    }
    onClose();
    router.push({
      pathname: "/operate/sales/new",
      params: { productId, ...(quote && { quantity: quote.quantity }) },
    });
  }
  return (
    <View className="gap-3">
      {question && (
        <Text className="self-end max-w-[92%] rounded-lg bg-muted px-3 py-2 text-sm">
          {question}
        </Text>
      )}
      <View className="gap-1 border-b border-border pb-3">
        <Heading level={2} size="page">
          {product.name}
        </Heading>
        <DialogDescription>
          {price ? t("assistant.chat.unitPrice", { price }) : t("assistant.chat.missingPrice")}
        </DialogDescription>
      </View>
      <View aria-live="polite" className="gap-3">
        {turns
          .filter((turn) => !turn.initial || turn.result.reply.kind !== "price")
          .map((turn) => (
            <View key={turn.id} className="gap-2">
              {!turn.initial && (
                <Text className="self-end max-w-[92%] rounded-lg bg-muted px-3 py-2 text-sm">
                  {turn.text}
                </Text>
              )}
              <AnswerText result={turn.result} canSell={canSell} />
            </View>
          ))}
        {busy && (
          <Text className="text-sm text-muted-foreground">{t("assistant.chat.checking")}</Text>
        )}
      </View>
      {message && (
        <Alert icon={TriangleAlert} variant="warning">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      {quote &&
        detail.data?.stock &&
        BigInt(quote.quantityMinorUnits) > BigInt(detail.data.stock.onHandMinorUnits) && (
          <Alert icon={TriangleAlert} variant="warning">
            <AlertDescription>
              {t("assistant.chat.shortStock", {
                quantity: quantityText(t, locale, {
                  minorUnits: detail.data.stock.onHandMinorUnits,
                  precision: product.quantityPrecision,
                  unitKind: product.unitKind,
                }),
              })}
            </AlertDescription>
          </Alert>
        )}
      <View className="flex-row items-center gap-2">
        <View className="min-w-0 flex-1">
          <Input
            accessibilityLabel={t("assistant.chat.input")}
            placeholder={t("assistant.chat.placeholder")}
            editable={!busy}
            maxLength={500}
            value={text}
            onChangeText={setText}
            onSubmitEditing={() => void submit()}
            returnKeyType="send"
          />
        </View>
        <Button
          size="icon"
          accessibilityLabel={t("assistant.chat.send")}
          disabled={!text.trim() || busy}
          loading={busy}
          onPress={() => void submit()}
        >
          <Icon as={Send} size={18} className="text-primary-foreground" />
        </Button>
      </View>
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        {chooseAnother}
        {canSell && (
          <Button
            size="sm"
            variant={quote ? "default" : "outline"}
            disabled={busy || Boolean(text.trim()) || Boolean(message)}
            onPress={openSale}
          >
            <Text>{t(quote ? "assistant.chat.review" : "assistant.chat.addOne")}</Text>
            <Icon as={ArrowUpRight} size={15} />
          </Button>
        )}
      </View>
    </View>
  );
}
