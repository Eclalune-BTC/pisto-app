import type { AssistantToolCall, BusinessPermission } from "@pisto/contracts";
import { useQuery } from "@tanstack/react-query";
import { LayoutList, Mic, PackageSearch, ReceiptText, TriangleAlert } from "lucide-react-native";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/cn";
import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";
import { matchBusinessQuestion, matchSaleTool, permitsTool } from "./business-questions";
import { Coco } from "./coco";
import { type EntryMode, NewEntryDialog } from "./new-entry-dialog";
import { problemMessageKeys, unsupportedMessageKeys } from "./problems";
import { type AssistantAvailability, useAssistantAvailability } from "./queries";
import { canRecord } from "./recorder";
import { type InterpretOutcome, useInterpretation } from "./use-interpretation";

const saleTool: AssistantToolCall = { name: "start_sale" };
const catalogTool: AssistantToolCall = { name: "find_product", query: null };

export function AssistantComposer({ layout = "panel" }: { layout?: "panel" | "bar" }) {
  const { t } = useTranslation();
  const availability = useAssistantAvailability();
  const businesses = useQuery(businessesQueryOptions);
  const business = getActiveBusiness(businesses.data);
  const userId = authClient.useSession().data?.user.id;
  if (!business || !userId || availability.kind === "hidden") return null;
  const wide = layout === "bar";
  if (availability.kind === "ready" || availability.kind === "disabled") {
    return (
      <ComposerForm
        key={JSON.stringify([userId, business.id])}
        wide={wide}
        availability={availability}
        permissions={business.access.permissions}
      />
    );
  }
  return (
    <ComposerFrame wide={wide}>
      {availability.kind === "loading" ? (
        <Skeleton className="h-10 w-full rounded-md" />
      ) : (
        <Alert
          icon={TriangleAlert}
          variant="warning"
          action={
            <Button
              label={t("common.retry")}
              onPress={availability.retry}
              size="sm"
              variant="outline"
            />
          }
        >
          <AlertDescription>{t("assistant.problems.statusFailed")}</AlertDescription>
        </Alert>
      )}
    </ComposerFrame>
  );
}

function ComposerFrame({
  wide,
  tools,
  children,
}: {
  wide: boolean;
  tools?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <View
      className={cn(
        "gap-3 rounded-xl border border-border bg-card px-4 py-3.5",
        wide && "flex-row items-center gap-7",
      )}
    >
      <View className={cn("flex-row items-center gap-3", wide && "w-[205px] shrink-0")}>
        <Coco size={wide ? 66 : 48} />
        <View className="min-w-0 flex-1">
          <Heading level={2} size="page">
            {t("assistant.companion.name")}
          </Heading>
          <Text className="text-sm text-muted-foreground">{t("assistant.companion.role")}</Text>
        </View>
        {!wide && tools}
      </View>
      <View className={cn("min-w-0", wide && "flex-1 border-l border-border pl-6")}>
        {children}
      </View>
    </View>
  );
}

function ComposerForm({
  wide,
  availability,
  permissions,
}: {
  wide: boolean;
  availability: Extract<AssistantAvailability, { kind: "ready" | "disabled" }>;
  permissions: readonly BusinessPermission[];
}) {
  const { t } = useTranslation();
  const { interpret, pending } = useInterpretation(availability.businessId);
  const [text, setText] = useState("");
  const [entry, setEntry] = useState<EntryMode | null>(null);
  const [question, setQuestion] = useState<string>();
  const [outcome, setOutcome] = useState<InterpretOutcome | null>(null);
  const [unrecognized, setUnrecognized] = useState(false);
  const alive = useRef(true);
  const sending = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const ready = availability.kind === "ready";
  const sentence = text.trim();
  const message = unrecognized
    ? "assistant.tools.limited"
    : outcome?.kind === "failed"
      ? problemMessageKeys[outcome.problem]
      : outcome?.kind === "unsupported"
        ? unsupportedMessageKeys[outcome.reason]
        : null;
  async function submit() {
    if (sentence.length < 2 || sending.current) return;
    if (!ready && !matchSaleTool(sentence) && !matchBusinessQuestion(sentence)) {
      setUnrecognized(true);
      return;
    }
    sending.current = true;
    try {
      const result = await interpret(
        { text: sentence, source: "text", allowTools: true },
        () => !alive.current,
      );
      if (!alive.current) return;
      setOutcome(result);
      if (result.kind === "tool") {
        setQuestion(matchSaleTool(sentence) ? undefined : sentence);
        setEntry(result.tool);
      }
      if (
        result.kind === "review" ||
        (result.kind === "tool" && result.tool.name === "answer_question")
      ) {
        setText("");
      }
    } finally {
      sending.current = false;
    }
  }
  const tools = (
    <Button
      className="min-h-9 gap-1.5 px-0"
      size="sm"
      variant="ghost"
      accessibilityLabel={t("assistant.tools.menu")}
      onPress={() => setEntry("tools")}
      disabled={pending}
    >
      <Icon as={LayoutList} size={15} className="text-muted-foreground" />
      <Text>{t("assistant.tools.menu")}</Text>
    </Button>
  );
  return (
    <ComposerFrame wide={wide} tools={tools}>
      <View className="gap-1.5">
        <View className="flex-row items-center gap-1.5">
          <View className="min-w-0 flex-1">
            <Input
              editable={!pending}
              accessibilityLabel={t("assistant.composer.inputLabel")}
              maxLength={1000}
              onChangeText={(v) => {
                setText(v);
                setOutcome(null);
                setUnrecognized(false);
              }}
              onSubmitEditing={() => void submit()}
              placeholder={t(
                ready ? "assistant.composer.placeholder" : "assistant.questions.placeholder",
              )}
              returnKeyType="send"
              value={text}
            />
          </View>
          {ready && availability.transcription && canRecord() && (
            <Button
              accessibilityLabel={t("assistant.composer.record")}
              disabled={pending}
              size="icon"
              variant="outline"
              onPress={() => setEntry("voice")}
            >
              <Icon as={Mic} className="text-foreground" size={17} />
            </Button>
          )}
          <Button
            disabled={sentence.length < 2}
            loading={pending}
            label={t("assistant.composer.submit")}
            onPress={() => void submit()}
          />
        </View>
        <View className="flex-row flex-wrap items-center gap-x-4 gap-y-0.5">
          {permitsTool(permissions, saleTool) && (
            <Button
              className="min-h-9 gap-1.5 px-0"
              size="sm"
              variant="ghost"
              onPress={() => setEntry(saleTool)}
              disabled={pending}
            >
              <Icon as={ReceiptText} size={15} className="text-foreground" />
              <Text>{t("assistant.tools.sale")}</Text>
            </Button>
          )}
          {permitsTool(permissions, catalogTool) && (
            <Button
              className="min-h-9 gap-1.5 px-0"
              size="sm"
              variant="ghost"
              onPress={() => setEntry(catalogTool)}
              disabled={pending}
            >
              <Icon as={PackageSearch} size={15} className="text-foreground" />
              <Text>{t("assistant.tools.catalog")}</Text>
            </Button>
          )}
          {wide && tools}
        </View>
        {message && (
          <Alert icon={TriangleAlert} variant="warning">
            <AlertDescription>{t(message)}</AlertDescription>
          </Alert>
        )}
        {entry !== null && (
          <NewEntryDialog
            initialQuestion={question}
            availability={availability}
            initialMode={entry}
            onOpenChange={(open) => {
              if (!open) {
                setEntry(null);
                setQuestion(undefined);
              }
            }}
            open
          />
        )}
      </View>
    </ComposerFrame>
  );
}
