import { useQueryClient } from "@tanstack/react-query";
import { Link, useRouter } from "expo-router";
import { Eye, EyeOff, TriangleAlert } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useUniwind } from "uniwind";
import { AppearanceControl } from "@/components/appearance-control";
import { Brand } from "@/components/brand";
import { DocumentTitle } from "@/components/document-title";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { DictationExample } from "@/features/welcome/dictation-example";
import { authClient } from "@/lib/auth-client";

type AuthMode = "sign-in" | "sign-up";

type FormErrors = {
  email?: string;
  name?: string;
  password?: string;
};

export function AuthScreen({ mode }: { mode: AuthMode }) {
  const { t } = useTranslation();
  const isSignUp = mode === "sign-up";
  const wide = useWindowDimensions().width >= 1024;
  const { theme } = useUniwind();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const submissionInFlight = useRef(false);
  const [expectedUserId, setExpectedUserId] = useState<string>();
  const [sessionRefreshSettled, setSessionRefreshSettled] = useState(false);
  const {
    data: session,
    error: sessionError,
    isPending: sessionPending,
    isRefetching: sessionRefetching,
    refetch,
  } = authClient.useSession();

  useEffect(() => {
    if (!expectedUserId) return;
    if (!sessionRefreshSettled || sessionPending || sessionRefetching) return;
    if (!sessionError && session?.user.id === expectedUserId) {
      setExpectedUserId(undefined);
      submissionInFlight.current = false;
      setSubmitting(false);
      queryClient.clear();
      router.replace("/dashboard");
    } else {
      setExpectedUserId(undefined);
      submissionInFlight.current = false;
      setSubmitting(false);
      setFormError(t("auth.errors.connection"));
    }
  }, [
    expectedUserId,
    session,
    sessionError,
    sessionPending,
    sessionRefetching,
    sessionRefreshSettled,
    queryClient,
    router,
    t,
  ]);

  const validate = () => {
    const nextErrors: FormErrors = {};
    if (isSignUp && name.trim().length < 2) {
      nextErrors.name = t("auth.validation.name");
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      nextErrors.email = t("auth.validation.email");
    }
    if (password.length < 8) {
      nextErrors.password = t("auth.validation.password");
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submit = async () => {
    if (submissionInFlight.current) return;
    setFormError(undefined);
    if (!validate()) return;

    submissionInFlight.current = true;
    setSubmitting(true);
    let awaitingSession = false;
    try {
      const result = isSignUp
        ? await authClient.signUp.email({
            email: email.trim().toLowerCase(),
            name: name.trim(),
            password,
          })
        : await authClient.signIn.email({
            email: email.trim().toLowerCase(),
            password,
          });

      if (result.error) {
        setFormError(isSignUp ? t("auth.errors.signUp") : t("auth.errors.signIn"));
        return;
      }

      if (!result.data?.user.id) throw new Error("Authentication returned no user identity.");
      awaitingSession = true;
      setSessionRefreshSettled(false);
      setExpectedUserId(result.data.user.id);
      // Better Auth schedules its session signal after the POST resolves. Keep
      // the form mounted until the atom confirms this exact authenticated user.
      void refetch({ query: { disableCookieCache: true } })
        .catch(() => {
          setExpectedUserId(undefined);
          submissionInFlight.current = false;
          setSubmitting(false);
          setFormError(t("auth.errors.connection"));
        })
        .finally(() => setSessionRefreshSettled(true));
    } catch {
      awaitingSession = false;
      setExpectedUserId(undefined);
      setFormError(t("auth.errors.connection"));
    } finally {
      if (!awaitingSession) {
        submissionInFlight.current = false;
        setSubmitting(false);
      }
    }
  };

  const passwordToggle = (
    <Button
      accessibilityLabel={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
      onPress={() => setShowPassword((value) => !value)}
      size="icon-sm"
      variant="ghost"
    >
      <Icon as={showPassword ? EyeOff : Eye} className="text-muted-foreground" size={16} />
    </Button>
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <View className="min-h-0 flex-1 flex-row">
          <ScrollView
            className="flex-1"
            contentContainerClassName="flex-grow"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View className="min-w-0 flex-1 gap-6 px-5 py-5 sm:px-10 sm:py-8">
              <View className="flex-row items-center justify-between gap-3">
                <Link href="/" replace asChild>
                  <Button
                    accessibilityLabel={t("auth.backToWelcome")}
                    className="px-0"
                    size="sm"
                    variant="ghost"
                  >
                    <Brand />
                  </Button>
                </Link>
                <AppearanceControl compact />
              </View>

              <View className="flex-1 items-center justify-center py-6" role="main">
                <View className="w-full max-w-[360px] gap-6">
                  <View className="gap-1.5">
                    <DocumentTitle
                      title={isSignUp ? t("auth.signUpTitle") : t("auth.signInTitle")}
                    />
                    <Heading className="text-[26px] leading-8 tracking-[-0.6px]">
                      {isSignUp ? t("auth.signUpTitle") : t("auth.signInTitle")}
                    </Heading>
                    <Text className="text-sm leading-5 text-muted-foreground">
                      {isSignUp ? t("auth.signUpDescription") : t("auth.signInDescription")}
                    </Text>
                  </View>

                  <View className="gap-4">
                    {isSignUp ? (
                      <Field
                        autoCapitalize="words"
                        autoComplete="name"
                        error={errors.name}
                        label={t("auth.name")}
                        onChangeText={setName}
                        placeholder={t("auth.namePlaceholder")}
                        returnKeyType="next"
                        value={name}
                      />
                    ) : null}
                    <Field
                      autoCapitalize="none"
                      autoComplete="email"
                      error={errors.email}
                      keyboardType="email-address"
                      label={t("auth.email")}
                      onChangeText={setEmail}
                      placeholder={t("auth.emailPlaceholder")}
                      returnKeyType="next"
                      value={email}
                    />
                    <Field
                      autoCapitalize="none"
                      autoComplete={isSignUp ? "new-password" : "current-password"}
                      description={isSignUp ? t("auth.passwordPlaceholder") : undefined}
                      error={errors.password}
                      label={t("auth.password")}
                      onChangeText={setPassword}
                      onSubmitEditing={submit}
                      returnKeyType="done"
                      secureTextEntry={!showPassword}
                      trailing={passwordToggle}
                      value={password}
                    />
                  </View>

                  {formError ? (
                    <Alert icon={TriangleAlert} variant="destructive">
                      <AlertDescription>{formError}</AlertDescription>
                    </Alert>
                  ) : null}

                  <Button
                    className="w-full rounded-lg"
                    label={isSignUp ? t("auth.createAccount") : t("auth.signIn")}
                    loading={submitting}
                    onPress={submit}
                    size="lg"
                  />

                  <View className="flex-row flex-wrap items-center justify-center gap-x-1.5">
                    <Text className="text-sm text-muted-foreground">
                      {isSignUp ? t("auth.alreadyRegistered") : t("auth.newToPisto")}
                    </Text>
                    <Link href={isSignUp ? "/sign-in" : "/sign-up"} replace asChild>
                      <Text className="font-ui text-sm text-foreground underline web:underline-offset-4">
                        {isSignUp ? t("auth.signInLink") : t("auth.createAccountLink")}
                      </Text>
                    </Link>
                  </View>
                </View>
              </View>
              <Text className="text-xs leading-4 text-muted-foreground">{t("auth.footer")}</Text>
            </View>
          </ScrollView>

          {wide ? (
            <View className="w-[52%] max-w-[760px] justify-center bg-primary px-12 py-12 dark:border-l dark:border-border dark:bg-card xl:px-20">
              <View className="w-full max-w-[520px] gap-6 self-center">
                <Text className="text-[17px] leading-7 text-primary-foreground/85 dark:text-foreground">
                  {t("auth.panel")}
                </Text>
                <DictationExample tone={theme === "dark" ? "default" : "inverse"} />
              </View>
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
