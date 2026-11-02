import type {
  AssignableBusinessRole,
  BusinessMember,
  ChangeBusinessMemberRoleRequest,
  RemoveBusinessMemberRequest,
} from "@pisto/contracts";
import { useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import type { TFunction } from "i18next";
import { CircleAlert, Eye, EyeOff, TriangleAlert } from "lucide-react-native";
import { useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { type TextInput, View } from "react-native";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Text } from "@/components/ui/text";
import { ApiClientError } from "@/lib/api-error";
import { cn } from "@/lib/cn";
import { type FocusReturnRef, returnFocusOnClose } from "@/lib/focus-return";
import { useKeyedCommand } from "@/lib/keyed-command";
import { isLockedPhase, type MutationPhase, withStableIdempotencyKey } from "@/lib/mutation-phase";
import { notify } from "@/lib/notify";
import { productErrorMessage } from "@/lib/product-errors";
import {
  type AddMemberDraft,
  type AddMemberProblems,
  ASSIGNABLE_ROLES,
  buildAddMemberCommand,
} from "./member-draft";
import { membersApi, membersQueryKey } from "./members-api";

type MemberCommand = "add" | "remove" | "role";

/** The sentence for a refused staff command; codes this screen cannot explain better fall through. */
function memberErrorMessage(error: unknown, command: MemberCommand, t: TFunction): string {
  if (error instanceof ApiClientError) {
    switch (error.code) {
      case "CONFLICT":
        if (command === "add") return t("settings.staff.errors.addConflict");
        return command === "role"
          ? t("settings.staff.errors.ownerConflict")
          : t("settings.staff.errors.removeConflict");
      case "VALIDATION_ERROR":
        if (command === "add") return t("settings.staff.errors.addValidation");
        break;
      case "FORBIDDEN":
        return t("settings.staff.errors.forbidden");
      case "NOT_FOUND":
        return t("settings.staff.errors.notFound");
      case "IDEMPOTENCY_CONFLICT":
        return t("settings.staff.errors.idempotency");
    }
  }
  return productErrorMessage(error, t("settings.staff.errors.fallback"), t);
}

function isAssignable(role: string): role is AssignableBusinessRole {
  return ASSIGNABLE_ROLES.some((candidate) => candidate === role);
}

/**
 * Two roles, each with what it may do. A radio group rather than a select: the select popover
 * opens in a portal beneath a dialog on the web, and both choices fit on screen anyway.
 */
function RoleField({
  disabled,
  error,
  onChange,
  value,
}: {
  disabled: boolean;
  error?: string;
  onChange: (role: AssignableBusinessRole) => void;
  value: AssignableBusinessRole | null;
}) {
  const { t } = useTranslation();
  const id = useId();
  const choose = (next: string) => {
    const role = ASSIGNABLE_ROLES.find((candidate) => candidate === next);
    if (!role) throw new Error("The chosen role is not one the owner can assign.");
    onChange(role);
  };
  return (
    <View className="min-w-0 gap-1.5">
      <Label className="text-[13px]" nativeID={`${id}-label`}>
        {t("settings.staff.role")}
      </Label>
      <RadioGroup
        aria-describedby={error ? `${id}-error` : undefined}
        aria-invalid={Boolean(error)}
        aria-labelledby={`${id}-label`}
        className={cn(
          "gap-0 overflow-hidden rounded-lg border border-border bg-card",
          error && "border-destructive",
        )}
        disabled={disabled}
        onValueChange={choose}
        value={value ?? undefined}
      >
        {ASSIGNABLE_ROLES.map((role, index) => (
          <View
            className={cn(
              "min-w-0 flex-row items-start gap-3 px-3 py-2.5",
              index > 0 && "border-t border-border",
            )}
            key={role}
          >
            <RadioGroupItem
              aria-describedby={`${id}-${role}-description`}
              aria-labelledby={`${id}-${role}-label`}
              className="mt-0.5"
              disabled={disabled}
              hitSlop={12}
              value={role}
            />
            <View className="min-w-0 flex-1 gap-0.5">
              <Label
                disabled={disabled}
                nativeID={`${id}-${role}-label`}
                onPress={() => choose(role)}
              >
                {t(`settings.roleNames.${role}`)}
              </Label>
              <Text
                className="text-xs leading-4 text-muted-foreground"
                nativeID={`${id}-${role}-description`}
              >
                {t(`settings.staff.roleDescriptions.${role}`)}
              </Text>
            </View>
          </View>
        ))}
      </RadioGroup>
      {error ? (
        <Text
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          className="text-[13px] leading-5 text-destructive"
          nativeID={`${id}-error`}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/** The outcome block every staff dialog shows under its fields. */
function CommandOutcome({ message, phase }: { message?: string; phase: MutationPhase }) {
  const { t } = useTranslation();
  if (phase === "uncertain") {
    return (
      <Alert icon={TriangleAlert} variant="warning">
        <AlertTitle>{t("common.uncertainTitle")}</AlertTitle>
        <AlertDescription>{t("settings.staff.uncertainDescription")}</AlertDescription>
      </Alert>
    );
  }
  if (phase === "failed" && message) {
    return (
      <Alert icon={CircleAlert} variant="destructive">
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    );
  }
  return null;
}

const emptyDraft: AddMemberDraft = { email: "", initialPassword: "", name: "", role: null };

/**
 * Adds a person to the business. Mounted while open, so each dialog starts empty with a new key;
 * an unchanged form sent again keeps its key and replays instead of adding twice.
 */
export function AddMemberDialog({
  businessId,
  onClose,
  returnFocus,
}: {
  businessId: string;
  onClose: () => void;
  returnFocus: HTMLElement | null;
}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [draft, setDraft] = useState(emptyDraft);
  const [problems, setProblems] = useState<AddMemberProblems>({});
  const [showPassword, setShowPassword] = useState(false);
  const nameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const command = useKeyedCommand({
    mutationFn: membersApi.add,
    onConfirmed: async ({ account, member }) => {
      await queryClient.invalidateQueries({ queryKey: membersQueryKey(businessId) });
      notify.success(t("settings.staff.added"), {
        description:
          account === "created"
            ? t("settings.staff.addedCreated", { name: member.name, email: member.email })
            : t("settings.staff.addedExisting", { name: member.name || member.email }),
      });
      onClose();
    },
  });
  const { phase } = command;
  const locked = isLockedPhase(phase);
  // An email that already has access is the email field's problem; other failures are the form's.
  const conflict =
    phase === "failed" &&
    command.error instanceof ApiClientError &&
    command.error.code === "CONFLICT";

  const update = (patch: Partial<AddMemberDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setProblems((current) => {
      const next = { ...current };
      for (const key of Object.keys(patch) as (keyof AddMemberDraft)[]) delete next[key];
      return next;
    });
    // A corrected form is a new command; the stale failure of the previous one goes away.
    if (phase === "failed") command.reset();
  };

  const submit = () => {
    if (phase === "pending") return;
    if (phase === "uncertain") {
      if (command.variables) command.send(command.variables);
      return;
    }
    const result = buildAddMemberCommand(draft, Crypto.randomUUID());
    if ("problems" in result) {
      setProblems(result.problems);
      const first = result.problems.name
        ? nameRef
        : result.problems.email
          ? emailRef
          : result.problems.initialPassword && !result.problems.role
            ? passwordRef
            : null;
      first?.current?.focus();
      return;
    }
    setProblems({});
    command.send(withStableIdempotencyKey(command.variables, result.command));
  };
  const close = () => {
    if (!locked) onClose();
  };

  const nameError =
    problems.name === "tooLong"
      ? t("settings.staff.problems.nameTooLong")
      : problems.name
        ? t("settings.staff.problems.nameMissing")
        : undefined;
  const emailError =
    problems.email === "missing"
      ? t("settings.staff.problems.emailMissing")
      : problems.email
        ? t("settings.staff.problems.emailInvalid")
        : conflict
          ? t("settings.staff.errors.addConflict")
          : undefined;
  const passwordError =
    problems.initialPassword === "tooLong"
      ? t("settings.staff.problems.passwordTooLong")
      : problems.initialPassword
        ? t("settings.staff.problems.passwordTooShort")
        : undefined;

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next) close();
      }}
      open
    >
      <DialogContent
        className="sm:max-w-md web:outline-none"
        hideClose={locked}
        onCloseAutoFocus={returnFocusOnClose(returnFocus)}
      >
        <DialogHeader>
          <DialogTitle>{t("settings.staff.addTitle")}</DialogTitle>
          <DialogDescription>{t("settings.staff.addDescription")}</DialogDescription>
        </DialogHeader>
        <View className="gap-4">
          <Field
            autoCapitalize="words"
            autoComplete="off"
            autoFocus
            editable={!locked}
            error={nameError}
            label={t("settings.staff.name")}
            maxLength={80}
            onChangeText={(name) => update({ name })}
            onSubmitEditing={() => emailRef.current?.focus()}
            placeholder={t("settings.staff.namePlaceholder")}
            ref={nameRef}
            returnKeyType="next"
            value={draft.name}
          />
          <Field
            autoCapitalize="none"
            autoComplete="off"
            editable={!locked}
            error={emailError}
            keyboardType="email-address"
            label={t("settings.staff.email")}
            maxLength={254}
            onChangeText={(email) => update({ email })}
            placeholder={t("settings.staff.emailPlaceholder")}
            ref={emailRef}
            returnKeyType="next"
            value={draft.email}
          />
          <RoleField
            disabled={locked}
            error={problems.role ? t("settings.staff.problems.roleMissing") : undefined}
            onChange={(role) => update({ role })}
            value={draft.role}
          />
          <Field
            autoCapitalize="none"
            autoComplete="new-password"
            description={t("settings.staff.initialPasswordDescription")}
            editable={!locked}
            error={passwordError}
            label={t("settings.staff.initialPassword")}
            maxLength={128}
            onChangeText={(initialPassword) => update({ initialPassword })}
            onSubmitEditing={submit}
            ref={passwordRef}
            returnKeyType="done"
            secureTextEntry={!showPassword}
            trailing={
              <Button
                accessibilityLabel={
                  showPassword ? t("settings.staff.hidePassword") : t("settings.staff.showPassword")
                }
                onPress={() => setShowPassword((shown) => !shown)}
                size="icon-sm"
                variant="ghost"
              >
                <Icon
                  as={showPassword ? EyeOff : Eye}
                  className="text-muted-foreground"
                  size={16}
                />
              </Button>
            }
            value={draft.initialPassword}
          />
        </View>
        <CommandOutcome
          message={conflict ? undefined : memberErrorMessage(command.error, "add", t)}
          phase={phase}
        />
        <DialogFooter>
          <Button disabled={locked} label={t("common.cancel")} onPress={close} variant="outline" />
          <Button
            label={
              phase === "uncertain"
                ? t("common.retrySameConfirmation")
                : t("settings.staff.confirmAdd")
            }
            loading={phase === "pending"}
            onPress={submit}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Makes a member an admin or a seller; the owner row never offers it. */
export function ChangeRoleDialog({
  businessId,
  member,
  onClose,
  returnFocus,
}: {
  businessId: string;
  member: BusinessMember;
  onClose: () => void;
  returnFocus: HTMLElement | null;
}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const name = member.name || member.email;
  const [role, setRole] = useState<AssignableBusinessRole | null>(
    isAssignable(member.role) ? member.role : null,
  );
  const [problem, setProblem] = useState<string>();
  const command = useKeyedCommand({
    mutationFn: (variables: ChangeBusinessMemberRoleRequest) =>
      membersApi.changeRole(member.id, variables),
    onConfirmed: async (result) => {
      await queryClient.invalidateQueries({ queryKey: membersQueryKey(businessId) });
      notify.success(t("settings.staff.roleChanged"), {
        description: t("settings.staff.roleChangedDescription", {
          name,
          role: t(`settings.roleNames.${result.member.role as AssignableBusinessRole}`),
        }),
      });
      onClose();
    },
  });
  const { phase } = command;
  const locked = isLockedPhase(phase);

  const submit = () => {
    if (phase === "pending") return;
    if (phase === "uncertain") {
      if (command.variables) command.send(command.variables);
      return;
    }
    if (!role) {
      setProblem(t("settings.staff.problems.roleMissing"));
      return;
    }
    if (role === member.role) {
      setProblem(t("settings.staff.problems.sameRole"));
      return;
    }
    setProblem(undefined);
    command.send(
      withStableIdempotencyKey(command.variables, { idempotencyKey: Crypto.randomUUID(), role }),
    );
  };
  const close = () => {
    if (!locked) onClose();
  };

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next) close();
      }}
      open
    >
      <DialogContent
        className="sm:max-w-md web:outline-none"
        hideClose={locked}
        onCloseAutoFocus={returnFocusOnClose(returnFocus)}
      >
        <DialogHeader>
          <DialogTitle>{t("settings.staff.roleTitle", { name })}</DialogTitle>
          <DialogDescription>{t("settings.staff.roleDescription")}</DialogDescription>
        </DialogHeader>
        <RoleField
          disabled={locked}
          error={problem}
          onChange={(next) => {
            setRole(next);
            setProblem(undefined);
            if (phase === "failed") command.reset();
          }}
          value={role}
        />
        <CommandOutcome message={memberErrorMessage(command.error, "role", t)} phase={phase} />
        <DialogFooter>
          <Button disabled={locked} label={t("common.cancel")} onPress={close} variant="outline" />
          <Button
            label={
              phase === "uncertain"
                ? t("common.retrySameConfirmation")
                : t("settings.staff.confirmRole")
            }
            loading={phase === "pending"}
            onPress={submit}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Takes a member out of the business after an explicit confirmation; one key per dialog. */
export function RemoveMemberDialog({
  businessId,
  businessName,
  member,
  onClose,
  returnFocus,
  returnFocusAfterRemoval,
}: {
  businessId: string;
  businessName: string;
  member: BusinessMember;
  onClose: () => void;
  returnFocus: HTMLElement | null;
  /** The removed row and its menu leave the page, so focus continues from a stable control. */
  returnFocusAfterRemoval: FocusReturnRef;
}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const name = member.name || member.email;
  const [removed, setRemoved] = useState(false);
  const removal = useKeyedCommand({
    mutationFn: (variables: RemoveBusinessMemberRequest) => membersApi.remove(member.id, variables),
    onConfirmed: async () => {
      setRemoved(true);
      await queryClient.invalidateQueries({ queryKey: membersQueryKey(businessId) });
      notify.success(t("settings.staff.removed"), { description: name });
      onClose();
    },
  });
  const { phase } = removal;
  return (
    <ConfirmDialog
      confirmLabel={t("settings.staff.remove")}
      description={t("settings.staff.removeDescription", { business: businessName })}
      destructive
      errorMessage={removal.error ? memberErrorMessage(removal.error, "remove", t) : undefined}
      onCancel={onClose}
      onConfirm={() => {
        if (phase === "pending") return;
        if (phase === "uncertain" && removal.variables) {
          removal.send(removal.variables);
          return;
        }
        // A removal has no fields; every attempt in one dialog is the same command.
        removal.send(removal.variables ?? { idempotencyKey: Crypto.randomUUID() });
      }}
      open
      phase={phase}
      returnFocus={removed ? returnFocusAfterRemoval : returnFocus}
      title={t("settings.staff.removeTitle", { name })}
      uncertainDescription={t("settings.staff.uncertainDescription")}
    />
  );
}
