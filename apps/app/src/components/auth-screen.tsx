import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Eye, EyeOff, ShieldCheck } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
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
    setFormError(undefined);
    if (!validate()) return;

    setSubmitting(true);
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

      queryClient.clear();
      router.replace("/dashboard");
    } catch {
      setFormError(t("auth.errors.connection"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-[#0F1D18]" edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerClassName="flex-grow"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="min-h-full flex-row">
            {Platform.OS === "web" ? (
              <View className="hidden w-[44%] justify-between bg-ink p-12 lg:flex">
                <Brand inverse />
                <View className="max-w-[480px] gap-6 border-l-4 border-accent pl-7">
                  <ShieldCheck color="#D9FB67" size={27} strokeWidth={2.3} />
                  <Text className="text-[46px] font-black leading-[50px] tracking-[-2px] text-white">
                    {t("auth.sideTitle")}
                  </Text>
                  <Text className="text-lg leading-7 text-[#B9CBC1]">
                    {t("auth.sideDescription")}
                  </Text>
                </View>
                <Text className="text-sm font-semibold text-[#8FA59A]">{t("auth.tagline")}</Text>
              </View>
            ) : null}

            <View
              className="min-w-0 flex-1 items-start justify-center px-5 py-8 sm:px-10 lg:px-[8%]"
              role="main"
            >
              <View className="w-full max-w-[470px] gap-8">
                <Pressable
                  accessibilityRole="button"
                  className={Platform.OS === "web" ? "lg:hidden" : undefined}
                  onPress={() => router.replace("/")}
                >
                  <Brand />
                </Pressable>

                <View className="gap-2">
                  <Text
                    accessibilityRole="header"
                    className="text-[34px] font-black tracking-[-1.2px] text-ink dark:text-white"
                  >
                    {isSignUp ? t("auth.signUpTitle") : t("auth.signInTitle")}
                  </Text>
                  <Text className="text-base leading-6 text-ink-muted dark:text-[#AAB8B0]">
                    {isSignUp ? t("auth.signUpDescription") : t("auth.signInDescription")}
                  </Text>
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
                      <Pressable
                        accessibilityLabel={
                          showPassword ? t("auth.hidePassword") : t("auth.showPassword")
                        }
                        accessibilityRole="button"
                        className="h-10 w-10 items-center justify-center"
                        onPress={() => setShowPassword((value) => !value)}
                      >
                        {showPassword ? (
                          <EyeOff color="#6C7B73" size={20} />
                        ) : (
                          <Eye color="#6C7B73" size={20} />
                        )}
                      </Pressable>
                    }
                    value={password}
                  />

                  {formError ? (
                    <View className="border-l-4 border-danger bg-[#FFF4F4] p-4 dark:bg-[#3B2323]">
                      <Text className="text-sm font-semibold leading-5 text-danger dark:text-[#FFBABA]">
                        {formError}
                      </Text>
                    </View>
                  ) : null}

                  <Button
                    label={isSignUp ? t("auth.createAccount") : t("auth.signIn")}
                    loading={submitting}
                    onPress={submit}
                    size="lg"
                    variant="primary"
                  />
                </View>

                <View className="flex-row flex-wrap gap-1">
                  <Text className="text-sm text-ink-muted dark:text-[#AAB8B0]">
                    {isSignUp ? t("auth.alreadyRegistered") : t("auth.newToPisto")}
                  </Text>
                  <Pressable
                    accessibilityRole="link"
                    onPress={() => router.replace(isSignUp ? "/sign-in" : "/sign-up")}
                  >
                    <Text className="text-sm font-bold text-positive dark:text-[#8DDEAF]">
                      {isSignUp ? t("auth.signInLink") : t("auth.createAccountLink")}
                    </Text>
                  </Pressable>
                </View>

                <Text className="text-xs leading-5 text-[#839188] dark:text-[#7F9087]">
                  {t("auth.securityNote")}
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
