import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Eye, EyeOff, ShieldCheck } from "lucide-react-native";
import { useState } from "react";
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
      nextErrors.name = "Enter the name you want us to use.";
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      nextErrors.email = "Enter a valid email address.";
    }
    if (password.length < 8) {
      nextErrors.password = "Use at least 8 characters.";
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
        setFormError(result.error.message || "We could not complete that request.");
        return;
      }

      queryClient.clear();
      router.replace("/dashboard");
    } catch {
      setFormError("We could not reach Pisto. Check your connection and try again.");
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
                <View className="max-w-[480px] gap-6">
                  <View className="h-14 w-14 items-center justify-center rounded-full bg-accent">
                    <ShieldCheck color="#14241D" size={27} strokeWidth={2.3} />
                  </View>
                  <Text className="text-[46px] font-black leading-[50px] tracking-[-2px] text-white">
                    A calmer relationship with money starts here.
                  </Text>
                  <Text className="text-lg leading-7 text-[#B9CBC1]">
                    Keep the plan simple, the next step visible, and your account protected across
                    devices.
                  </Text>
                </View>
                <Text className="text-sm font-semibold text-[#8FA59A]">
                  Pisto · Clear by design
                </Text>
              </View>
            ) : null}

            <View className="min-w-0 flex-1 items-center justify-center px-5 py-8 sm:px-10">
              <View className="w-full max-w-[470px] gap-8">
                <Pressable
                  accessibilityRole="button"
                  className={Platform.OS === "web" ? "lg:hidden" : undefined}
                  onPress={() => router.replace("/")}
                >
                  <Brand />
                </Pressable>

                <View className="gap-2">
                  <Text className="text-[34px] font-black tracking-[-1.2px] text-ink dark:text-white">
                    {isSignUp ? "Create your account" : "Welcome back"}
                  </Text>
                  <Text className="text-base leading-6 text-ink-muted dark:text-[#AAB8B0]">
                    {isSignUp
                      ? "Start with the essentials. You can shape the rest later."
                      : "Sign in to pick up your plan where you left it."}
                  </Text>
                </View>

                <View className="gap-5">
                  {isSignUp ? (
                    <Field
                      autoCapitalize="words"
                      autoComplete="name"
                      error={errors.name}
                      label="Name"
                      onChangeText={setName}
                      placeholder="Your name"
                      returnKeyType="next"
                      value={name}
                    />
                  ) : null}
                  <Field
                    autoCapitalize="none"
                    autoComplete="email"
                    error={errors.email}
                    keyboardType="email-address"
                    label="Email"
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    returnKeyType="next"
                    value={email}
                  />
                  <Field
                    autoCapitalize="none"
                    autoComplete={isSignUp ? "new-password" : "current-password"}
                    error={errors.password}
                    label="Password"
                    onChangeText={setPassword}
                    onSubmitEditing={submit}
                    placeholder="At least 8 characters"
                    returnKeyType="done"
                    secureTextEntry={!showPassword}
                    trailing={
                      <Pressable
                        accessibilityLabel={showPassword ? "Hide password" : "Show password"}
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
                    <View className="rounded-2xl border border-[#F0CACA] bg-[#FFF4F4] p-4 dark:border-[#653838] dark:bg-[#3B2323]">
                      <Text className="text-sm font-semibold leading-5 text-danger dark:text-[#FFBABA]">
                        {formError}
                      </Text>
                    </View>
                  ) : null}

                  <Button
                    label={isSignUp ? "Create account" : "Sign in"}
                    loading={submitting}
                    onPress={submit}
                    size="lg"
                    variant="primary"
                  />
                </View>

                <View className="flex-row flex-wrap justify-center gap-1">
                  <Text className="text-sm text-ink-muted dark:text-[#AAB8B0]">
                    {isSignUp ? "Already have an account?" : "New to Pisto?"}
                  </Text>
                  <Pressable
                    accessibilityRole="link"
                    onPress={() => router.replace(isSignUp ? "/sign-in" : "/sign-up")}
                  >
                    <Text className="text-sm font-bold text-positive dark:text-[#8DDEAF]">
                      {isSignUp ? "Sign in" : "Create one"}
                    </Text>
                  </Pressable>
                </View>

                <Text className="text-center text-xs leading-5 text-[#839188] dark:text-[#7F9087]">
                  By continuing, you agree to use Pisto responsibly and keep your account
                  credentials private.
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
