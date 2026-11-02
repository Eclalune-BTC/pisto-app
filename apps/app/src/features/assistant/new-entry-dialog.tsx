import { useQueryClient } from "@tanstack/react-query";
import { Keyboard, Mic, Square, TriangleAlert } from "lucide-react-native";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";
import { assistantApi } from "./api";
import { type AssistantProblem, assistantProblem, problemMessageKeys } from "./problems";
import { type AssistantAvailability, assistantQueryKeys } from "./queries";
import {
  canRecord,
  MAX_RECORDING_SECONDS,
  RecorderError,
  type Recording,
  startRecording,
} from "./recorder";
import { useInterpretation } from "./use-interpretation";

const BARS = 36;
const MIN_TEXT = 2;
const MAX_TEXT = 1_000;

export type EntryMode = "voice" | "text";

type VoiceProblem = "denied" | "unsupported" | "failed" | "silence";

type Phase =
  | { kind: "text" }
  | { kind: "requesting" }
  | { kind: "recording" }
  | { kind: "transcribing" }
  | { kind: "interpreting"; from: "voice" | "text" }
  | { kind: "voiceProblem"; problem: VoiceProblem | AssistantProblem; audio: Blob | null };

/** Text shown next to the editable sentence after an attempt that produced no draft. */
type TextNotice = "notARecord" | "severalRecords" | AssistantProblem | "tooShort" | null;

const voiceProblemKeys = {
  denied: "assistant.problems.micDenied",
  unsupported: "assistant.problems.micUnsupported",
  failed: "assistant.problems.micFailed",
  silence: "assistant.problems.silence",
} as const satisfies Record<VoiceProblem, string>;

const textNoticeKeys = {
  notARecord: "assistant.problems.notARecord",
  severalRecords: "assistant.problems.severalRecords",
  ...problemMessageKeys,
} as const;

function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Live input level; the elapsed time beside it is the accessible equivalent. */
function Waveform({ levels }: { levels: readonly number[] }) {
  const { t } = useTranslation();
  return (
    <View
      accessibilityLabel={t("assistant.dialog.levelLabel")}
      className="h-14 flex-row items-center justify-center gap-[3px]"
      role="img"
    >
      {levels.map((level, index) => (
        <View
          className="w-[3px] rounded-full bg-primary-foreground"
          // biome-ignore lint/suspicious/noArrayIndexKey: bars are positional and only shift
          key={index}
          style={{ height: Math.max(3, Math.round(level * 52)), opacity: 0.35 + level * 0.65 }}
        />
      ))}
    </View>
  );
}

function Examples({ onPick }: { onPick?: (example: string) => void }) {
  const { t } = useTranslation();
  const examples = [t("assistant.dialog.examples.expense"), t("assistant.dialog.examples.payment")];
  return (
    <View className="gap-1.5">
      <Text className="text-[13px] leading-5 text-muted-foreground">
        {t("assistant.dialog.examplesTitle")}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {examples.map((example) =>
          onPick ? (
            <Button
              key={example}
              label={`«${example}»`}
              onPress={() => onPick(example)}
              size="sm"
              variant="outline"
            />
          ) : (
            <Text className="text-[13px] leading-5 text-foreground" key={example}>
              «{example}»
            </Text>
          ),
        )}
      </View>
    </View>
  );
}

type NewEntryDialogProps = {
  availability: Exclude<AssistantAvailability, { kind: "hidden" }>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Voice falls back to text where recording or transcription is unavailable. */
  initialMode: EntryMode;
  /** Pre-fills the text, for example from the home composer. */
  initialText?: string;
};

/** "Nuevo registro": dictate or write one sentence, then review the draft before saving. */
export function NewEntryDialog(props: NewEntryDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog onOpenChange={props.onOpenChange} open={props.open}>
      <DialogContent className="gap-4 sm:max-w-xl">
        <DialogHeader className="pr-8">
          <DialogTitle>{t("assistant.dialog.title")}</DialogTitle>
        </DialogHeader>
        {props.open ? <EntryBody {...props} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function EntryBody({ availability, initialMode, initialText, onOpenChange }: NewEntryDialogProps) {
  const { t } = useTranslation();
  if (availability.kind === "loading") {
    return (
      <View aria-busy className="gap-3" role="progressbar">
        <Skeleton className="h-28 w-full rounded-lg" />
        <Skeleton className="h-9 w-40 self-end rounded-md" />
      </View>
    );
  }
  if (availability.kind === "error") {
    return (
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
    );
  }
  if (availability.kind === "disabled") {
    return (
      <Alert icon={TriangleAlert} role="note" variant="warning">
        <AlertTitle>{t("assistant.problems.disabledTitle")}</AlertTitle>
        <AlertDescription>{t("assistant.problems.disabled")}</AlertDescription>
      </Alert>
    );
  }
  const voiceAvailable = availability.transcription && canRecord();
  return (
    <EntryFlow
      businessId={availability.businessId}
      initialMode={voiceAvailable ? initialMode : "text"}
      initialText={initialText ?? ""}
      onClose={() => onOpenChange(false)}
      voiceAvailable={voiceAvailable}
    />
  );
}

function EntryFlow({
  businessId,
  initialMode,
  initialText,
  onClose,
  voiceAvailable,
}: {
  businessId: string;
  initialMode: EntryMode;
  initialText: string;
  onClose: () => void;
  voiceAvailable: boolean;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { interpret } = useInterpretation(businessId);
  const [phase, setPhase] = useState<Phase>(
    initialMode === "voice" ? { kind: "requesting" } : { kind: "text" },
  );
  const [text, setText] = useState(initialText);
  const [source, setSource] = useState<"voice" | "text">("text");
  const [notice, setNotice] = useState<TextNotice>(null);
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0));
  const [elapsed, setElapsed] = useState(0);
  const recording = useRef<Recording | null>(null);
  const transcription = useRef<AbortController | null>(null);
  const alive = useRef(true);
  /** Bumped when the user leaves the microphone, so a late permission grant cannot resume it. */
  const attempt = useRef(0);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      recording.current?.cancel();
      recording.current = null;
      transcription.current?.abort();
    };
  }, []);

  async function review(sentence: string, from: "voice" | "text") {
    setPhase({ kind: "interpreting", from });
    const outcome = await interpret({ text: sentence, source: from }, () => !alive.current);
    if (!alive.current || outcome.kind === "abandoned") return;
    if (outcome.kind === "review") {
      onClose();
      return;
    }
    setNotice(
      outcome.kind === "unsupported"
        ? outcome.reason === "several_records"
          ? "severalRecords"
          : "notARecord"
        : outcome.problem,
    );
    setPhase({ kind: "text" });
  }

  async function transcribe(audio: Blob) {
    setPhase({ kind: "transcribing" });
    const controller = new AbortController();
    transcription.current = controller;
    try {
      const heard = (await assistantApi.transcribe(audio, controller.signal)).trim();
      if (!alive.current) return;
      if (heard.length < MIN_TEXT) {
        setPhase({ kind: "voiceProblem", problem: "silence", audio: null });
        return;
      }
      setText(heard.slice(0, MAX_TEXT));
      setSource("voice");
      await review(heard.slice(0, MAX_TEXT), "voice");
    } catch (error) {
      if (!alive.current || controller.signal.aborted) return;
      const problem = assistantProblem(error);
      if (problem === "provider") {
        void queryClient.invalidateQueries({ queryKey: assistantQueryKeys.status(businessId) });
      }
      setPhase({ kind: "voiceProblem", problem, audio });
    }
  }

  async function stopAndReview() {
    const active = recording.current;
    if (!active) return;
    recording.current = null;
    try {
      await transcribe(await active.stop());
    } catch {
      if (alive.current) setPhase({ kind: "voiceProblem", problem: "failed", audio: null });
    }
  }

  async function listen() {
    attempt.current += 1;
    const current = attempt.current;
    setNotice(null);
    setElapsed(0);
    setLevels(Array(BARS).fill(0));
    setPhase({ kind: "requesting" });
    try {
      const started = await startRecording((level) => {
        if (alive.current) setLevels((previous) => [...previous.slice(1), level]);
      });
      if (!alive.current || attempt.current !== current) {
        started.cancel();
        return;
      }
      recording.current = started;
      setPhase({ kind: "recording" });
    } catch (error) {
      if (!alive.current || attempt.current !== current) return;
      setPhase({
        kind: "voiceProblem",
        problem: error instanceof RecorderError ? error.reason : "failed",
        audio: null,
      });
    }
  }

  function writeInstead() {
    attempt.current += 1;
    recording.current?.cancel();
    recording.current = null;
    transcription.current?.abort();
    setPhase({ kind: "text" });
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: recording starts once, on open
  useEffect(() => {
    if (initialMode === "voice") void listen();
  }, []);

  const recordingNow = phase.kind === "recording";
  // Reads the current recording when the limit is reached, without restarting the timer.
  const reachLimit = useEffectEvent(() => void stopAndReview());
  useEffect(() => {
    if (!recordingNow) return;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const seconds = Math.floor((Date.now() - startedAt) / 1_000);
      setElapsed(seconds);
      if (seconds >= MAX_RECORDING_SECONDS) reachLimit();
    }, 250);
    return () => clearInterval(timer);
  }, [recordingNow]);

  function submitText() {
    const sentence = text.trim();
    if (sentence.length < MIN_TEXT) {
      setNotice("tooShort");
      return;
    }
    setNotice(null);
    void review(sentence.slice(0, MAX_TEXT), source);
  }

  if (phase.kind === "text" || (phase.kind === "interpreting" && phase.from === "text")) {
    const interpreting = phase.kind === "interpreting";
    const noticeKey = notice && notice !== "tooShort" ? textNoticeKeys[notice] : null;
    return (
      <View className="gap-4">
        <DialogDescription>{t("assistant.dialog.textDescription")}</DialogDescription>
        <Field
          autoFocus
          editable={!interpreting}
          error={notice === "tooShort" ? t("assistant.dialog.textTooShort") : undefined}
          label={t("assistant.dialog.textLabel")}
          maxLength={MAX_TEXT}
          multiline
          numberOfLines={4}
          onChangeText={(value) => {
            setText(value);
            if (notice === "tooShort") setNotice(null);
          }}
          placeholder={t("assistant.dialog.textPlaceholder")}
          value={text}
        />
        {noticeKey ? (
          <Alert icon={TriangleAlert} variant="warning">
            <AlertDescription>{t(noticeKey)}</AlertDescription>
          </Alert>
        ) : null}
        <Examples
          onPick={(example) => {
            setText(example);
            setSource("text");
            setNotice(null);
          }}
        />
        <View className="flex-row flex-wrap items-center justify-between gap-2">
          {voiceAvailable ? (
            <Button disabled={interpreting} onPress={() => void listen()} size="sm" variant="ghost">
              <Icon as={Mic} className="text-foreground" size={16} />
              <Text>{t("assistant.dialog.dictateInstead")}</Text>
            </Button>
          ) : (
            <View />
          )}
          <View className="flex-row gap-2">
            <Button label={t("common.cancel")} onPress={onClose} variant="outline" />
            <Button
              label={t("assistant.dialog.review")}
              loading={interpreting}
              onPress={submitText}
            />
          </View>
        </View>
      </View>
    );
  }

  if (phase.kind === "voiceProblem") {
    const message =
      phase.problem in voiceProblemKeys
        ? t(voiceProblemKeys[phase.problem as VoiceProblem])
        : t(problemMessageKeys[phase.problem as AssistantProblem]);
    const audio = phase.audio;
    const canRetryMicrophone = phase.problem === "silence" || phase.problem === "failed";
    return (
      <View className="gap-4">
        <Alert icon={TriangleAlert} variant="warning">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
        <View className="flex-row flex-wrap items-center justify-between gap-2">
          <Button onPress={writeInstead} size="sm" variant="ghost">
            <Icon as={Keyboard} className="text-foreground" size={16} />
            <Text>{t("assistant.dialog.writeInstead")}</Text>
          </Button>
          <View className="flex-row gap-2">
            <Button label={t("common.cancel")} onPress={onClose} variant="outline" />
            {audio ? (
              <Button label={t("common.retry")} onPress={() => void transcribe(audio)} />
            ) : canRetryMicrophone ? (
              <Button label={t("common.retry")} onPress={() => void listen()} />
            ) : null}
          </View>
        </View>
      </View>
    );
  }

  const status =
    phase.kind === "requesting"
      ? t("assistant.dialog.requesting")
      : phase.kind === "transcribing"
        ? t("assistant.dialog.transcribing")
        : phase.kind === "interpreting"
          ? t("assistant.dialog.interpreting")
          : t("assistant.dialog.listening");
  const busy = phase.kind === "transcribing" || phase.kind === "interpreting";
  return (
    <View className="gap-4">
      <DialogDescription>{t("assistant.dialog.description")}</DialogDescription>
      <View className="items-center gap-2 rounded-lg bg-primary px-4 py-5">
        <Waveform levels={levels} />
        <View aria-live="polite" className="flex-row items-center gap-2">
          <View
            className={cn(
              "size-2 rounded-full",
              recordingNow ? "bg-highlight" : "bg-primary-foreground/40",
            )}
          />
          <Text className="font-ui text-sm text-primary-foreground">{status}</Text>
          {recordingNow ? (
            <Text className="text-sm tabular-nums text-primary-foreground/80">
              {t("assistant.dialog.elapsed", {
                elapsed: clock(elapsed),
                limit: clock(MAX_RECORDING_SECONDS),
              })}
            </Text>
          ) : null}
        </View>
      </View>
      <Examples />
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <Button disabled={busy} onPress={writeInstead} size="sm" variant="ghost">
          <Icon as={Keyboard} className="text-foreground" size={16} />
          <Text>{t("assistant.dialog.writeInstead")}</Text>
        </Button>
        <View className="flex-row gap-2">
          <Button label={t("common.cancel")} onPress={onClose} variant="outline" />
          <Button disabled={!recordingNow} loading={busy} onPress={() => void stopAndReview()}>
            {busy ? null : <Icon as={Square} className="text-primary-foreground" size={14} />}
            <Text>{t("assistant.dialog.stopAndReview")}</Text>
          </Button>
        </View>
      </View>
    </View>
  );
}
