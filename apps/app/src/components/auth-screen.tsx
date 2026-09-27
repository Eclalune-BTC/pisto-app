import { useQueryClient } from "@tanstack/react-query";
import { Link, useRouter } from "expo-router";
import { Eye, EyeOff } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppearanceControl } from "@/components/appearance-control";
import { Brand } from "@/components/brand";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardDescription } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Heading } from "@/components/ui/heading";
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

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerClassName="flex-grow"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="min-w-0 flex-1 items-center justify-center px-5 py-10" role="main">
            <View className="w-full max-w-[420px] gap-6">
              <View className="flex-row flex-wrap items-center justify-between gap-3">
                <Link href="/" replace asChild>
                  <Button
                    accessibilityLabel={t("auth.backToWelcome")}
                    className="self-center px-0"
                    size="sm"
                    variant="ghost"
                  >
                    <Brand />
                  </Button>
                </Link>
                <AppearanceControl compact />
              </View>

              <Card className="gap-6">
                <View className="gap-2">
                  <Heading>{isSignUp ? t("auth.signUpTitle") : t("auth.signInTitle")}</Heading>
                  <CardDescription>
                    {isSignUp ? t("auth.signUpDescription") : t("auth.signInDescription")}
                  </CardDescription>
                </View>

                <View className="gap-5">
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
                    error={errors.password}
                    label={t("auth.password")}
                    onChangeText={setPassword}
                    onSubmitEditing={submit}
                    placeholder={t("auth.passwordPlaceholder")}
                    returnKeyType="done"
                    secureTextEntry={!showPassword}
                    trailing={
                      <Button
                        accessibilityLabel={
                          showPassword ? t("auth.hidePassword") : t("auth.showPassword")
                        }
                        size="icon"
                        variant="ghost"
                        onPress={() => setShowPassword((value) => !value)}
                      >
                        {showPassword ? (
                          <EyeOff color="#6C7B73" size={20} />
                        ) : (
                          <Eye color="#6C7B73" size={20} />
                        )}
                      </Button>
                    }
                    value={password}
                  />

                  {formError ? <Alert tone="danger">{formError}</Alert> : null}

                  <Button
                    label={isSignUp ? t("auth.createAccount") : t("auth.signIn")}
                    loading={submitting}
                    onPress={submit}
                    variant="accent"
                  />
                </View>

                <View className="flex-row flex-wrap items-center gap-x-1">
                  <Text className="text-sm text-muted-foreground">
                    {isSignUp ? t("auth.alreadyRegistered") : t("auth.newToPisto")}
                  </Text>
                  <Link href={isSignUp ? "/sign-in" : "/sign-up"} replace asChild>
                    <Button className="px-0" size="sm" variant="ghost">
                      <Text className="text-sm font-semibold text-link underline">
                        {isSignUp ? t("auth.signInLink") : t("auth.createAccountLink")}
                      </Text>
                    </Button>
                  </Link>
                </View>
              </Card>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
