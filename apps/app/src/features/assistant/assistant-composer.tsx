import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import type { ParseKeys } from "i18next";
import { Mic, TriangleAlert } from "lucide-react-native";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { type TextInput, View } from "react-native";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";
import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";
import { isAccessDeniedError } from "@/lib/query-state";
import { businessQuestions, matchBusinessQuestion, questionKinds } from "./business-questions";
import { NewEntryDialog } from "./new-entry-dialog";
import { problemMessageKeys, unsupportedMessageKeys } from "./problems";
import { useAssistantAvailability } from "./queries";
import { canRecord } from "./recorder";
import { type InterpretOutcome, useInterpretation } from "./use-interpretation";

const starters = ["sale", "purchase", "expense", "payment"] as const;
type ComposerOutcome = InterpretOutcome | { kind: "unknownQuestion" };

function outcomeMessageKey(outcome: ComposerOutcome | null): ParseKeys | null {
  if (!outcome || outcome.kind === "review" || outcome.kind === "abandoned") return null;
  if (outcome.kind === "unknownQuestion") return "assistant.questions.help";
  if (outcome.kind === "unsupported") return unsupportedMessageKeys[outcome.reason];
  return problemMessageKeys[outcome.problem];
}

/**
 * The home "Registrar" panel: one line to type or dictate a record, reviewed before saving. The
 * chips start the sentence for the record kind. `bar` lays it across a wide page, with the title
 * beside the line instead of above it.
 */
export function AssistantComposer({ layout = "panel" }: { layout?: "panel" | "bar" }) {
  const { t } = useTranslation();
  const availability = useAssistantAvailability();
  const businesses = useQuery(businessesQueryOptions);
  const business = getActiveBusiness(businesses.data);
  if (availability.kind === "hidden" || isAccessDeniedError(businesses.error)) return null;
  const bar = layout === "bar";
  return (
    <View
      className={cn(
        "gap-3 rounded-xl border border-border bg-card p-4",
        bar && "flex-row items-center gap-8",
      )}
    >
      <View className={cn("gap-0.5", bar && "w-[200px] shrink-0")}>
        <Heading level={2} size="section">
          {t("assistant.composer.title")}
        </Heading>
        <Text className="text-dense text-muted-foreground">
          {t(
            availability.kind === "disabled"
              ? "assistant.questions.description"
              : "assistant.composer.description",
          )}
        </Text>
      </View>
      <View className={cn("gap-3", bar && "min-w-0 flex-1")}>
        {availability.kind === "loading" ? (
          <Skeleton className="h-9 w-full rounded-md" />
        ) : availability.kind === "error" ? (
          <Alert
            action={
              <Button
                label={t("common.retry")}
                onPress={availability.retry}
                size="sm"
                variant="outline"
              />
            }
            icon={TriangleAlert}
            variant="warning"
          >
            <AlertDescription>{t("assistant.problems.statusFailed")}</AlertDescription>
          </Alert>
        ) : (
          <ComposerForm
            businessId={availability.businessId}
            questionsOnly={availability.kind === "disabled"}
            voice={availability.kind === "ready" && availability.transcription && canRecord()}
          />
        )}
        <View className="flex-row flex-wrap items-center gap-x-4 gap-y-1">
          {questionKinds
            .filter((kind) =>
              business?.access.permissions.includes(businessQuestions[kind].permission),
            )
            .map((kind) => (
              <Link asChild href={businessQuestions[kind].href} key={kind}>
                <Button accessibilityRole="link" className="min-h-9 px-0" size="sm" variant="link">
                  <Text className="text-sm text-link underline web:underline-offset-4">
                    {t(`assistant.questions.${kind}`)}
                  </Text>
                </Button>
              </Link>
            ))}
        </View>
      </View>
    </View>
  );
}

function ComposerForm({
  businessId,
  questionsOnly,
  voice,
}: {
  businessId: string;
  questionsOnly: boolean;
  voice: boolean;
}) {
  const { t } = useTranslation();
  const availability = useAssistantAvailability();
  const { interpret, pending } = useInterpretation(businessId);
  const [text, setText] = useState("");
  const [outcome, setOutcome] = useState<ComposerOutcome | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const input = useRef<TextInput>(null);
  const messageKey = outcomeMessageKey(outcome);
  const sentence = text.trim();

  async function submit() {
    if (sentence.length < 2 || pending) return;
    if (questionsOnly && !matchBusinessQuestion(sentence)) {
      setOutcome({ kind: "unknownQuestion" });
      return;
    }
    setOutcome(null);
    const result = await interpret({ text: sentence.slice(0, 1_000), source: "text" });
    setOutcome(result);
    if (result.kind === "review") setText("");
  }

  return (
    // The closed dialog still leaves an empty element; it stays outside the spaced column so it
    // does not add a gap under the chips.
    <View>
      <View className="gap-3">
        <View className="flex-row items-center gap-2">
          <View className="min-w-0 flex-1">
            <Input
              accessibilityLabel={t(
                questionsOnly ? "assistant.questions.input" : "assistant.composer.inputLabel",
              )}
              maxLength={1_000}
              onChangeText={(value) => {
                setText(value);
                setOutcome(null);
              }}
              onSubmitEditing={() => void submit()}
              placeholder={t(
                questionsOnly ? "assistant.questions.input" : "assistant.composer.placeholder",
              )}
              ref={input}
              returnKeyType="send"
              value={text}
            />
          </View>
          {voice ? (
            <Button
              accessibilityLabel={t("assistant.composer.record")}
              onPress={() => setDialogOpen(true)}
              size="icon"
              variant="outline"
            >
              <Icon as={Mic} className="text-foreground" size={16} />
            </Button>
          ) : null}
          <Button
            disabled={sentence.length < 2}
            label={t(questionsOnly ? "assistant.questions.submit" : "assistant.composer.submit")}
            loading={pending}
            onPress={() => void submit()}
          />
        </View>
        {!questionsOnly && (
          <View className="flex-row flex-wrap gap-1.5">
            {starters.map((starter) => (
              <Button
                className="h-7 px-2.5"
                key={starter}
                label={t(`assistant.composer.chips.${starter}`)}
                onPress={() => {
                  setText(t(`assistant.composer.starters.${starter}`));
                  setOutcome(null);
                  input.current?.focus();
                }}
                size="sm"
                variant="outline"
              />
            ))}
          </View>
        )}
        {messageKey ? (
          <Alert icon={TriangleAlert} variant="warning">
            <AlertDescription>{t(messageKey)}</AlertDescription>
          </Alert>
        ) : null}
      </View>
      {availability.kind === "hidden" ? null : (
        <NewEntryDialog
          availability={availability}
          initialMode="voice"
          onOpenChange={setDialogOpen}
          open={dialogOpen}
        />
      )}
    </View>
  );
}
