import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Building2 } from "lucide-react-native";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { useCSSVariable } from "uniwind";
import { Page } from "@/components/page";
import { OfflineState, StaleNotice } from "@/components/remote-state";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { Text } from "@/components/ui/text";
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
  const foregroundColor = useCSSVariable("--color-foreground") as string;
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
  const creationLocked = creation.isPending || uncertainCreation;

  const createBusiness = () => {
    if (creation.isPending) return;
    if (uncertainCreation) {
      if (creation.variables) creation.mutate(creation.variables);
      return;
    }
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
        <LoadingIndicator color={foregroundColor} size="large" />
        <Text className="text-sm font-ui text-muted-foreground">{t("business.loading")}</Text>
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
        <View className="gap-3 border-l-4 border-destructive bg-destructive-surface p-4 ">
          <Text className="font-ui text-destructive ">{t("business.loadFailed")}</Text>
          <Button
            className="self-start"
            label={t("common.retry")}
            onPress={() => businesses.refetch()}
            variant="outline"
          />
        </View>
      ) : businesses.data && businesses.data.items.length > 0 ? (
        <View className="gap-6 border-y border-border py-6 ">
          <View className="flex-row items-start gap-4">
            <Building2 color={foregroundColor} size={24} />
            <View className="min-w-0 flex-1 gap-1">
              <Text className="text-xl font-heading text-foreground">
                {businesses.data.items[0]?.name}
              </Text>
              <Text className="text-sm leading-5 text-muted-foreground">
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
            variant="default"
          />
          {selection.error ? (
            <Text className="text-sm text-destructive ">{t("business.continueFailed")}</Text>
          ) : null}
        </View>
      ) : (
        <View className="gap-7 border-y border-border py-7 ">
          <View className="gap-5">
            <Field
              autoCapitalize="words"
              editable={!creationLocked}
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
                  editable={!creationLocked}
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
                  editable={!creationLocked}
                  error={errors.timeZone}
                  label={t("business.timeZone")}
                  onChangeText={setTimeZone}
                  placeholder={t("business.timeZonePlaceholder")}
                  value={timeZone}
                />
              </View>
            </View>
          </View>

          <View className="min-h-12 flex-row items-start gap-3">
            <Checkbox
              accessibilityLabel={t("business.acknowledgment")}
              aria-labelledby="business-acknowledgment-label"
              checked={acknowledged}
              className="mt-3"
              disabled={creationLocked}
              nativeID="business-acknowledgment"
              onCheckedChange={(checked) => {
                if (!creationLocked) setAcknowledged(checked);
              }}
            />
            <View className="min-w-0 flex-1">
              <Label
                className="min-h-11 flex-1 py-3 leading-5"
                disabled={creationLocked}
                nativeID="business-acknowledgment-label"
                onPress={() => {
                  if (!creationLocked) setAcknowledged((value) => !value);
                }}
              >
                {t("business.acknowledgment")}
              </Label>
            </View>
          </View>

          <View className="gap-3">
            <Button
              className="self-start"
              disabled={!acknowledged || name.trim().length < 2}
              label={uncertainCreation ? t("common.retrySameConfirmation") : t("business.create")}
              loading={creation.isPending}
              onPress={createBusiness}
              variant="default"
            />
            {creation.error ? (
              <Text accessibilityRole="alert" className="text-sm text-destructive ">
                {uncertainCreation
                  ? t("business.uncertain")
                  : productErrorMessage(creation.error, t("business.createFailed"), t, "business")}
              </Text>
            ) : null}
          </View>
        </View>
      )}

      <Text className="text-xs leading-5 text-muted-foreground ">
        {t("business.incrementNote")}
      </Text>
    </Page>
  );
}
