import type { BusinessPeriod, BusinessPermission, BusinessReply } from "@pisto/contracts";
import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { ArrowLeft, ArrowUpRight, Send, TriangleAlert } from "lucide-react-native";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, type TextInput, View } from "react-native";
import { StaleNotice } from "@/components/remote-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FilterBar } from "@/components/ui/filter-bar";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { readState } from "@/features/customers/read-state";
import { formatLocalDate } from "@/i18n/format";
import { requireSupportedLocale } from "@/i18n/locale";
import { cn } from "@/lib/cn";
import { answerView } from "./answer-view";
import {
  type CocoTool,
  type ConversationTurn,
  isPeriodTopic,
  matchBusinessQuestion,
  matchSaleTool,
  permitsReply,
  permitsTopic,
  type QuestionTool,
  sourceHrefs,
  suggestedQuestions,
  topicHrefs,
} from "./business-questions";
import { problemMessageKeys, unsupportedMessageKeys } from "./problems";
import { businessAnswerQueryOptions } from "./queries";
import { useInterpretation } from "./use-interpretation";

type ThreadTool = QuestionTool | ConversationTurn;
type Exchange<T extends ThreadTool = ThreadTool> = {
  id: number;
  question: string;
  tool: T;
  /** The period the question named, kept among the choices after another one is picked. */
  asked: BusinessPeriod | null;
};

/** The periods offered under an answer, besides the one asked and the one in use. */
const offeredPeriods: readonly BusinessPeriod[] = [
  "today",
  "this_week",
  "this_month",
  "last_month",
];
const periodOrder: readonly BusinessPeriod[] = [
  "today",
  "yesterday",
  "this_week",
  "last_week",
  "this_month",
  "last_month",
  "last_7_days",
  "last_30_days",
];
const maxExchanges = 4;

function Answer({
  businessId,
  exchange,
  permitted,
  latest,
  onPeriod,
  onClose,
}: {
  businessId: string;
  exchange: Exchange<QuestionTool>;
  permitted: boolean;
  /** Only the newest answer carries the period control and the link to its screen. */
  latest: boolean;
  onPeriod: (period: BusinessPeriod) => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = requireSupportedLocale(i18n.resolvedLanguage);
  const { topic } = exchange.tool;
  const result = useQuery(
    businessAnswerQueryOptions(permitted ? businessId : undefined, exchange.tool),
  );
  const read = permitted ? readState([result]) : ({ kind: "denied" } as const);
  const answer = read.kind === "ready" ? result.data?.answer : undefined;

  let body: ReactNode;
  if (answer) {
    const view = answerView(t, locale, answer);
    body = (
      <>
        {read.kind === "ready" && read.stale ? (
          <StaleNotice loading={result.isFetching} onRetry={() => void result.refetch()} />
        ) : null}
        <View className="gap-1">
          <Text className="font-ui text-base leading-6">{view.lead}</Text>
          {view.details.map((detail) => (
            <Text className="text-base leading-6" key={detail}>
              {detail}
            </Text>
          ))}
        </View>
        {view.rows.length > 0 ? (
          <View className="border-t border-border">
            {view.rows.map((row) => (
              <View
                className="flex-row items-center justify-between gap-3 border-b border-border py-2"
                key={row.key}
              >
                <View className="min-w-0 flex-1">
                  <Text className="text-dense">{row.label}</Text>
                  {row.note ? (
                    <Text
                      className={cn(
                        "text-xs",
                        row.overdue ? "text-destructive" : "text-muted-foreground",
                      )}
                    >
                      {row.note}
                    </Text>
                  ) : null}
                </View>
                <Text
                  className={cn(
                    "font-ui text-dense tabular-nums",
                    row.overdue && !row.note && "text-destructive",
                  )}
                >
                  {row.value}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
        <Text className="text-xs leading-4 text-muted-foreground">
          {view.note ? `${view.scope} · ${view.note}` : view.scope}
        </Text>
      </>
    );
  } else if (read.kind === "loading") {
    body = (
      <View aria-busy className="gap-2">
        <Text className="text-sm text-muted-foreground">{t("assistant.answers.reading")}</Text>
        <Skeleton className="h-5 w-4/5 rounded-md" />
        <Skeleton className="h-5 w-3/5 rounded-md" />
      </View>
    );
  } else if (read.kind === "denied") {
    body = (
      <Text className="text-base leading-6">
        {t(permitted ? "assistant.answers.refused" : "assistant.answers.denied")}
      </Text>
    );
  } else {
    body = (
      <Alert
        action={
          <Button
            label={t("common.retry")}
            onPress={() => void result.refetch()}
            size="sm"
            variant="outline"
          />
        }
        icon={TriangleAlert}
        variant="warning"
      >
        <AlertDescription>
          {t(read.kind === "offline" ? "assistant.answers.offline" : "assistant.answers.failed")}
        </AlertDescription>
      </Alert>
    );
  }

  const period = exchange.tool.period ?? (answer && "period" in answer ? answer.period.key : null);
  const periods = periodOrder.filter(
    (key) => offeredPeriods.includes(key) || key === period || key === exchange.asked,
  );
  return (
    <View className="gap-2.5">
      {body}
      {/* Stays mounted while another period loads, so the control keeps the keyboard focus. */}
      {latest && permitted ? (
        <View className="flex-row flex-wrap items-center justify-between gap-2">
          {period && isPeriodTopic(topic) ? (
            <FilterBar
              label={t("assistant.answers.periodLabel")}
              onChange={onPeriod}
              options={periods.map((key) => ({
                label: t(`assistant.answers.periodShort.${key}`),
                value: key,
              }))}
              value={period}
            />
          ) : (
            <View />
          )}
          <Link asChild href={topicHrefs[topic]}>
            <Button accessibilityRole="link" onPress={onClose} size="sm" variant="outline">
              <Text>{t(`assistant.answers.open.${topic}`)}</Text>
              <Icon as={ArrowUpRight} className="text-foreground" size={15} />
            </Button>
          </Link>
        </View>
      ) : null}
    </View>
  );
}

function ConversationAnswer({
  reply,
  permissions,
  onClose,
}: {
  reply: BusinessReply;
  permissions: readonly BusinessPermission[];
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  if (!permitsReply(permissions, reply)) return <Text>{t("assistant.answers.denied")}</Text>;
  if (reply.kind === "gap")
    return (
      <Text className="text-base leading-6">{t(`assistant.questions.gaps.${reply.reason}`)}</Text>
    );
  const date = formatLocalDate(reply.asOf, requireSupportedLocale(i18n.resolvedLanguage));
  return (
    <View className="gap-2">
      <Text className="text-base leading-6">{reply.text}</Text>
      <Text className="text-xs text-muted-foreground">
        {t("assistant.questions.grounded", { date })}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {reply.sources.map((source) => (
          <Link key={source} asChild href={sourceHrefs[source]}>
            <Button
              accessibilityRole="link"
              onPress={onClose}
              size="sm"
              variant="outline"
              label={t(`assistant.answers.open.${source}`)}
            />
          </Link>
        ))}
      </View>
    </View>
  );
}

/** Questions about the business, each answered with figures Pisto reads from its records. */
export function BusinessThread({
  businessId,
  permissions,
  canInterpret,
  businessConversation,
  initial,
  onBusy,
  onTool,
  onBack,
  onClose,
}: {
  businessId: string;
  permissions: readonly BusinessPermission[];
  canInterpret: boolean;
  businessConversation: boolean;
  initial: { question: string; tool: ThreadTool };
  /** True while a typed question is being interpreted. */
  onBusy: (busy: boolean) => void;
  /** A follow-up that asks for a sale or a product leaves the thread. */
  onTool: (tool: CocoTool, sentence: string) => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { interpret } = useInterpretation(businessId, businessConversation);
  const sequence = useRef(1);
  const [exchanges, setExchanges] = useState<Exchange[]>([
    {
      id: 0,
      ...initial,
      asked: initial.tool.name === "answer_question" ? initial.tool.period : null,
    },
  ]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const [notice, setNotice] = useState<string | null>(null);
  const latest = useRef<View>(null);
  const field = useRef<TextInput>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    onBusy(busy);
    return () => onBusy(false);
  }, [busy, onBusy]);
  const newest = exchanges.at(-1)?.id;
  // A new question starts at the top of the dialog, so its answer is read from the first line.
  useEffect(() => {
    if (Platform.OS !== "web" || newest === 0) return;
    (latest.current as unknown as HTMLElement | null)?.scrollIntoView?.({ block: "start" });
  }, [newest]);

  function append(question: string, tool: ThreadTool) {
    const id = sequence.current++;
    setExchanges((previous) => [
      ...previous.slice(1 - maxExchanges),
      { id, question, tool, asked: tool.name === "answer_question" ? tool.period : null },
    ]);
    setText("");
  }

  async function ask(sentence: string) {
    if (sentence.length < 2 || sending.current) return;
    setNotice(null);
    if (
      !canInterpret &&
      !businessConversation &&
      !matchSaleTool(sentence) &&
      !matchBusinessQuestion(sentence)
    ) {
      setNotice(t("assistant.answers.unknown"));
      return;
    }
    sending.current = true;
    setBusy(true);
    const outcome = await interpret(
      { text: sentence, source: "text", allowTools: true },
      () => !alive.current,
      exchanges.slice(-3).map((entry) => entry.question),
    );
    sending.current = false;
    if (!alive.current || outcome.kind === "abandoned") return;
    setBusy(false);
    if (outcome.kind === "review") onClose();
    else if (outcome.kind === "tool") {
      if (outcome.tool.name === "answer_question" || outcome.tool.name === "business_reply")
        append(sentence, outcome.tool);
      else onTool(outcome.tool, sentence);
    } else if (outcome.kind === "unsupported") {
      setNotice(
        t(
          outcome.reason === "not_a_record"
            ? "assistant.answers.unknown"
            : unsupportedMessageKeys[outcome.reason],
        ),
      );
    } else setNotice(t(problemMessageKeys[outcome.problem]));
  }

  const asked = new Set(
    exchanges.flatMap(({ tool }) =>
      tool.name === "answer_question"
        ? [tool.topic]
        : tool.reply.kind === "answer"
          ? tool.reply.sources
          : [],
    ),
  );
  const suggestions = suggestedQuestions
    .filter(({ tool }) => !asked.has(tool.topic) && permitsTopic(permissions, tool.topic))
    .slice(0, 3);

  return (
    <View className="pisto-caption-in gap-4">
      <View aria-live="polite" className="gap-4">
        {exchanges.map((exchange, index) => (
          <View
            className="gap-2.5"
            key={exchange.id}
            ref={index === exchanges.length - 1 ? latest : undefined}
          >
            <Text className="max-w-[92%] self-end rounded-lg bg-muted px-3 py-2 text-sm">
              {exchange.question}
            </Text>
            {exchange.tool.name === "business_reply" ? (
              <ConversationAnswer
                reply={exchange.tool.reply}
                permissions={permissions}
                onClose={onClose}
              />
            ) : (
              <Answer
                businessId={businessId}
                exchange={{ ...exchange, tool: exchange.tool }}
                latest={index === exchanges.length - 1}
                onClose={onClose}
                onPeriod={(period) =>
                  setExchanges((previous) =>
                    previous.map((entry) =>
                      entry.id === exchange.id && entry.tool.name === "answer_question"
                        ? { ...entry, tool: { ...entry.tool, period } }
                        : entry,
                    ),
                  )
                }
                permitted={permitsTopic(permissions, exchange.tool.topic)}
              />
            )}
          </View>
        ))}
        {busy ? (
          <Text className="text-sm text-muted-foreground">{t("assistant.answers.reading")}</Text>
        ) : null}
      </View>
      {notice ? (
        <Alert icon={TriangleAlert} variant="warning">
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ) : null}
      <View className="gap-2 border-t border-border pt-3">
        <View className="flex-row items-center gap-2">
          <View className="min-w-0 flex-1">
            <Input
              accessibilityLabel={t("assistant.answers.input")}
              // Sending keeps the field focused for the next question.
              blurOnSubmit={false}
              maxLength={1000}
              onChangeText={(value) => {
                setText(value);
                setNotice(null);
              }}
              onSubmitEditing={() => void ask(text.trim())}
              placeholder={t("assistant.answers.placeholder")}
              ref={field}
              returnKeyType="send"
              value={text}
            />
          </View>
          <Button
            accessibilityLabel={t("assistant.answers.send")}
            disabled={text.trim().length < 2 || busy}
            loading={busy}
            onPress={() => void ask(text.trim())}
            size="icon"
          >
            <Icon as={Send} className="text-primary-foreground" size={18} />
          </Button>
        </View>
        {suggestions.length > 0 ? (
          <View className="gap-1.5">
            <Text className="text-xs text-muted-foreground">
              {t("assistant.answers.suggestions")}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {suggestions.map(({ key, tool }) => (
                <Button
                  disabled={busy}
                  key={key}
                  label={t(`assistant.questions.suggested.${key}`)}
                  onPress={() => {
                    setNotice(null);
                    const question = t(`assistant.questions.suggested.${key}`);
                    if (businessConversation) {
                      setText(question);
                      void ask(question);
                    } else append(question, tool);
                    // The pressed suggestion leaves the list; the field takes the focus it held.
                    field.current?.focus();
                  }}
                  size="sm"
                  variant="outline"
                />
              ))}
            </View>
          </View>
        ) : null}
      </View>
      <Button className="self-start" onPress={onBack} size="sm" variant="ghost">
        <Icon as={ArrowLeft} className="text-foreground" size={14} />
        <Text>{t("assistant.tools.menu")}</Text>
      </Button>
    </View>
  );
}
