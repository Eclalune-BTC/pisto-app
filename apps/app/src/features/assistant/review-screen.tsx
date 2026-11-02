import type { AssistantDraft, AssistantInterpretation } from "@pisto/contracts";
import { useQuery } from "@tanstack/react-query";
import { Redirect, useRouter } from "expo-router";
import { Mic, PencilLine, TriangleAlert } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/layout/section";
import { Page } from "@/components/page";
import { RouteState } from "@/components/route-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { StatePanel } from "@/components/ui/state-panel";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { TranscriptHighlight } from "@/components/ui/transcript-highlight";
import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";
import { hasDeniedRead } from "@/lib/query-state";
import { previewDraftFormSlots } from "./draft-preview";
import { type DraftFormSlots, ReviewMarkersProvider, renderDraftForm } from "./draft-slots";
import { type EntryMode, NewEntryDialog } from "./new-entry-dialog";
import { noticeMessage } from "./notices";
import { problemMessageKeys } from "./problems";
import { type AssistantAvailability, useAssistantAvailability } from "./queries";
import { canRecord } from "./recorder";
import { reviewStore, useReviewEntry } from "./review-store";
import { type InterpretOutcome, useInterpretation } from "./use-interpretation";

const unsupportedKeys = {
  not_a_record: "assistant.problems.notARecord",
  several_records: "assistant.problems.severalRecords",
} as const;

function Notices({
  interpretation,
  draft,
}: {
  interpretation: AssistantInterpretation;
  draft: AssistantDraft;
}) {
  const { t } = useTranslation();
  if (interpretation.notices.length === 0) return null;
  return (
    <Alert icon={TriangleAlert} variant="warning">
      <AlertTitle>{t("assistant.review.noticesTitle")}</AlertTitle>
      {interpretation.notices.map((notice, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: notices are positional and never reorder
        <AlertDescription key={index}>{noticeMessage(t, notice, draft)}</AlertDescription>
      ))}
    </Alert>
  );
}

/** "Lo que usted dijo": the sentence with every fragment Pisto used, and ways to change it. */
function TranscriptPanel({
  interpret,
  interpretation,
  onRedictate,
  pending,
  voice,
}: {
  interpret: ReturnType<typeof useInterpretation>["interpret"];
  interpretation: AssistantInterpretation;
  onRedictate: (() => void) | null;
  pending: boolean;
  voice: boolean;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(interpretation.text);
  const [outcome, setOutcome] = useState<InterpretOutcome | null>(null);
  const sentence = text.trim();

  async function reinterpret() {
    setOutcome(null);
    const result = await interpret({ text: sentence, source: interpretation.source });
    if (result.kind === "review") setEditing(false);
    else setOutcome(result);
  }

  const messageKey =
    outcome?.kind === "unsupported"
      ? unsupportedKeys[outcome.reason]
      : outcome?.kind === "failed"
        ? problemMessageKeys[outcome.problem]
        : null;

  return (
    <View className="gap-4 rounded-lg bg-primary p-4 lg:p-5">
      <View className="flex-row items-center justify-between gap-3">
        <Text className="font-ui text-sm text-primary-foreground">
          {t("assistant.review.transcriptTitle")}
        </Text>
        <Text className="text-xs text-primary-foreground/70">
          {t(`assistant.review.sources.${interpretation.source}`)}
        </Text>
      </View>
      {editing ? (
        <View className="gap-3">
          <Textarea
            accessibilityLabel={t("assistant.review.editLabel")}
            autoFocus
            editable={!pending}
            maxLength={1_000}
            numberOfLines={4}
            onChangeText={(value) => {
              setText(value);
              setOutcome(null);
            }}
            value={text}
          />
          {messageKey ? (
            <Alert icon={TriangleAlert} variant="warning">
              <AlertDescription>{t(messageKey)}</AlertDescription>
            </Alert>
          ) : null}
          <View className="flex-row flex-wrap gap-2">
            <Button
              disabled={sentence.length < 2}
              label={t("assistant.review.reinterpret")}
              loading={pending}
              onPress={() => void reinterpret()}
              size="sm"
              variant="secondary"
            />
            <Button
              disabled={pending}
              label={t("assistant.review.cancelEdit")}
              onPress={() => {
                setEditing(false);
                setText(interpretation.text);
                setOutcome(null);
              }}
              size="sm"
              variant="ghost"
              className="web:hover:bg-primary-foreground/10"
            />
          </View>
        </View>
      ) : (
        <>
          <TranscriptHighlight
            spans={interpretation.spans}
            text={interpretation.text}
            tone="inverse"
          />
          <View className="flex-row flex-wrap gap-2">
            <Button
              onPress={() => {
                setText(interpretation.text);
                setEditing(true);
              }}
              size="sm"
              variant="secondary"
            >
              <Icon as={PencilLine} className="text-secondary-foreground" size={14} />
              <Text>{t("assistant.review.editText")}</Text>
            </Button>
            {voice && onRedictate ? (
              <Button onPress={onRedictate} size="sm" variant="secondary">
                <Icon as={Mic} className="text-secondary-foreground" size={14} />
                <Text>{t("assistant.review.redictate")}</Text>
              </Button>
            ) : null}
          </View>
        </>
      )}
    </View>
  );
}

function ReviewSkeleton() {
  return (
    <View aria-busy className="gap-3" role="progressbar">
      <Skeleton className="h-9 w-full rounded-md" />
      <Skeleton className="h-64 w-full rounded-lg" />
    </View>
  );
}

type ReviewScreenProps = {
  /** The record forms, one per draft kind; the application composes them. */
  slots?: DraftFormSlots;
};

/** Figure 13: what the user said beside how the record would look, before anything is saved. */
export function AssistantReviewScreen({ slots = previewDraftFormSlots }: ReviewScreenProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const businesses = useQuery(businessesQueryOptions);
  const business = getActiveBusiness(businesses.data);
  const availability = useAssistantAvailability();
  const entry = useReviewEntry(business?.id);
  const [dialog, setDialog] = useState<EntryMode | null>(null);
  const { interpret, pending } = useInterpretation(business?.id);

  if (businesses.data && !business) return <Redirect href="/business" />;
  if (hasDeniedRead([businesses])) return <RouteState kind="denied" width="content" />;
  if (!business) {
    return businesses.isError ? (
      <RouteState kind="error" onRetry={() => void businesses.refetch()} />
    ) : (
      <RouteState kind="loading" variant="form" />
    );
  }
  if (availability.kind === "hidden") {
    return (
      <RouteState
        description={t("assistant.problems.denied")}
        kind="denied"
        title={t("assistant.review.deniedTitle")}
      />
    );
  }

  const voice = availability.kind === "ready" && availability.transcription && canRecord();
  const dialogElement = (
    <EntryDialog availability={availability} mode={dialog} onClose={() => setDialog(null)} />
  );

  if (!entry?.interpretation.draft) {
    return (
      <Page width="form">
        <StatePanel
          action={
            availability.kind === "disabled" ? undefined : (
              <Button
                label={t("assistant.review.start")}
                onPress={() => setDialog(voice ? "voice" : "text")}
              />
            )
          }
          description={
            availability.kind === "disabled"
              ? t("assistant.problems.disabled")
              : t("assistant.review.emptyDescription")
          }
          icon={availability.kind === "disabled" ? TriangleAlert : Mic}
          level={1}
          title={
            availability.kind === "disabled"
              ? t("assistant.problems.disabledTitle")
              : t("assistant.review.emptyTitle")
          }
        />
        {dialogElement}
      </Page>
    );
  }

  const { interpretation } = entry;
  const draft = entry.interpretation.draft;
  const leave = () => {
    reviewStore.clear();
    router.replace("/operate");
  };

  return (
    <Page>
      <PageHeader
        description={t("assistant.review.description")}
        title={t(`assistant.review.titles.${draft.kind}`)}
      />
      <View className="gap-6 lg:flex-row lg:items-start">
        <View className="gap-4 lg:w-[380px] lg:shrink-0">
          <TranscriptPanel
            interpret={interpret}
            interpretation={interpretation}
            key={entry.revision}
            onRedictate={availability.kind === "ready" ? () => setDialog("voice") : null}
            pending={pending}
            voice={voice}
          />
        </View>
        <View className="min-w-0 flex-1">
          <Section title={t("assistant.review.formTitle")}>
            {pending ? (
              <ReviewSkeleton />
            ) : (
              <>
                <Notices draft={draft} interpretation={interpretation} />
                <ReviewMarkersProvider spans={interpretation.spans}>
                  <View key={entry.revision}>
                    {renderDraftForm(slots, draft, {
                      entrySource: interpretation.source,
                      onCancel: leave,
                      onSaved: leave,
                    })}
                  </View>
                </ReviewMarkersProvider>
              </>
            )}
          </Section>
        </View>
      </View>
      {dialogElement}
    </Page>
  );
}

function EntryDialog({
  availability,
  mode,
  onClose,
}: {
  availability: Exclude<AssistantAvailability, { kind: "hidden" }>;
  mode: EntryMode | null;
  onClose: () => void;
}) {
  return (
    <NewEntryDialog
      availability={availability}
      initialMode={mode ?? "text"}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      open={mode !== null}
    />
  );
}
