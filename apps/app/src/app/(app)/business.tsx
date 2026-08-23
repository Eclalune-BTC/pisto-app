import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Building2, Check } from "lucide-react-native";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Page } from "@/components/page";
import { OfflineState, StaleNotice } from "@/components/remote-state";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { buildBusinessCommand } from "@/features/business/business-draft";
import { api, isAmbiguousMutationError } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";
import { productErrorMessage } from "@/lib/product-errors";
import { businessesQueryKey, businessesQueryOptions } from "@/lib/queries/businesses";

const detectedTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

type BusinessErrors = Partial<Record<"name" | "currency" | "timeZone", string>>;

async function selectActiveBusiness(organizationId: string) {
  const result = await authClient.organization.setActive({ organizationId });
  if (result.error) throw new Error("The active business could not be selected.");
}

export default function BusinessSetupScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const businesses = useQuery(businessesQueryOptions);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("");
  const [timeZone, setTimeZone] = useState(detectedTimeZone);
  const [acknowledged, setAcknowledged] = useState(false);
  const [errors, setErrors] = useState<BusinessErrors>({});

  useEffect(() => {
    if (
      businesses.data?.activeBusinessId &&
      businesses.data.items.some(({ id }) => id === businesses.data?.activeBusinessId)
    ) {
      router.replace("/operate");
    }
  }, [businesses.data, router]);

  const selection = useMutation({
    mutationFn: selectActiveBusiness,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: businessesQueryKey });
      router.replace("/operate");
    },
  });

  const creation = useMutation({
    mutationFn: api.businesses.create,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: businessesQueryKey });
      router.replace("/operate");
    },
    onError: async (error) => {
      if (isAmbiguousMutationError(error)) await businesses.refetch();
    },
  });
  const uncertainCreation = isAmbiguousMutationError(creation.error);

  const createBusiness = () => {
    const result = buildBusinessCommand({ currency, name, timeZone });
    const nextErrors = result.ok
      ? {}
      : Object.fromEntries(
          result.fields.map((field) => [field, t(`business.validation.${field}`)]),
        );
    setErrors(nextErrors);
    if (result.ok) creation.mutate(result.command);
  };

  if (businesses.fetchStatus === "paused" && !businesses.data) return <OfflineState />;

  if (businesses.isPending) {
    return (
      <View className="flex-1 items-start justify-center gap-3 px-5 sm:px-8 lg:px-10">
        <ActivityIndicator color="#237A55" size="large" />
        <Text className="text-sm font-semibold text-ink-muted dark:text-[#AAB8B0]">
          {t("business.loading")}
        </Text>
      </View>
    );
  }

  return (
    <Page width="form">
      <ScreenHeader
        description={t("business.description")}
        eyebrow={t("business.eyebrow")}
        title={t("business.title")}
      />

      {businesses.isError && businesses.data ? <StaleNotice /> : null}

      {businesses.isError && !businesses.data ? (
        <View className="gap-3 border-l-4 border-danger bg-[#FFF1F1] p-4 dark:bg-[#3A2020]">
          <Text className="font-bold text-danger dark:text-[#FFBABA]">
            {t("business.loadFailed")}
          </Text>
          <Button
            className="self-start"
            label={t("common.retry")}
            onPress={() => businesses.refetch()}
            variant="secondary"
          />
        </View>
      ) : businesses.data && businesses.data.items.length > 0 ? (
        <View className="gap-6 border-y border-line py-6 dark:border-[#304239]">
          <View className="flex-row items-start gap-4">
            <Building2 color="#237A55" size={24} />
            <View className="min-w-0 flex-1 gap-1">
              <Text className="text-xl font-black text-ink dark:text-white">
                {businesses.data.items[0]?.name}
              </Text>
              <Text className="text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
                {businesses.data.items[0]?.currency} · {businesses.data.items[0]?.timeZone}
              </Text>
            </View>
          </View>
          <Button
            className="self-start"
            label={t("business.continue")}
            loading={selection.isPending}
            onPress={() => {
              const business = businesses.data?.items[0];
              if (business) selection.mutate(business.id);
            }}
            variant="accent"
          />
          {selection.error ? (
            <Text className="text-sm text-danger dark:text-[#FFBABA]">
              {t("business.continueFailed")}
            </Text>
          ) : null}
        </View>
      ) : (
        <View className="gap-7 border-y border-line py-7 dark:border-[#304239]">
          <View className="gap-5">
            <Field
              autoCapitalize="words"
              editable={!uncertainCreation}
              error={errors.name}
              label={t("business.name")}
              maxLength={80}
              onChangeText={setName}
              placeholder={t("business.namePlaceholder")}
              value={name}
            />
            <View className="gap-5 sm:flex-row">
              <View className="flex-1">
                <Field
                  autoCapitalize="characters"
                  editable={!uncertainCreation}
                  error={errors.currency}
                  label={t("business.currency")}
                  maxLength={3}
                  onChangeText={setCurrency}
                  placeholder={t("business.currencyPlaceholder")}
                  value={currency}
                />
              </View>
              <View className="flex-1">
                <Field
                  autoCapitalize="none"
                  editable={!uncertainCreation}
                  error={errors.timeZone}
                  label={t("business.timeZone")}
                  onChangeText={setTimeZone}
                  placeholder={t("business.timeZonePlaceholder")}
                  value={timeZone}
                />
              </View>
            </View>
          </View>

          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: acknowledged }}
            className="flex-row items-start gap-3"
            onPress={() => setAcknowledged((value) => !value)}
          >
            <View
              className={`mt-0.5 h-6 w-6 items-center justify-center border ${
                acknowledged ? "border-positive bg-positive" : "border-[#87958D] bg-white"
              }`}
              style={{ height: 24, width: 24 }}
            >
              {acknowledged ? <Check color="#FFFFFF" size={16} strokeWidth={3} /> : null}
            </View>
            <Text className="min-w-0 flex-1 text-sm leading-5 text-ink dark:text-[#DCE6E0]">
              {t("business.acknowledgment")}
            </Text>
          </Pressable>

          <View className="gap-3">
            <Button
              className="self-start"
              disabled={!acknowledged || name.trim().length < 2}
              label={uncertainCreation ? t("common.retrySameConfirmation") : t("business.create")}
              loading={creation.isPending}
              onPress={createBusiness}
              variant="accent"
            />
            {creation.error ? (
              <Text accessibilityRole="alert" className="text-sm text-danger dark:text-[#FFBABA]">
                {uncertainCreation
                  ? t("business.uncertain")
                  : productErrorMessage(creation.error, t("business.createFailed"), t, "business")}
              </Text>
            ) : null}
          </View>
        </View>
      )}

      <Text className="text-xs leading-5 text-ink-muted dark:text-[#91A198]">
        {t("business.incrementNote")}
      </Text>
    </Page>
  );
}
