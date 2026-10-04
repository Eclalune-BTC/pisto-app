import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ArrowRight, CircleAlert, TriangleAlert } from "lucide-react-native";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { PageHeader } from "@/components/layout/page-header";
import { ContentSkeleton } from "@/components/layout/skeletons";
import { Page } from "@/components/page";
import { OfflineState, StaleNotice } from "@/components/remote-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { StatePanel } from "@/components/ui/state-panel";
import { Text } from "@/components/ui/text";
import { buildBusinessCommand } from "@/features/business/business-draft";
import {
  BUSINESS_CURRENCIES,
  BUSINESS_TIME_ZONES,
  isListedCurrency,
  isListedTimeZone,
  OTHER_OPTION,
} from "@/features/business/business-options";
import { api, isAmbiguousMutationError } from "@/lib/api-client";
import { initialsOf } from "@/lib/initials";
import { productErrorMessage } from "@/lib/product-errors";
import {
  businessesQueryKey,
  businessesQueryOptions,
  selectActiveBusiness,
} from "@/lib/queries/businesses";

const detectedTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

type BusinessErrors = Partial<Record<"name" | "currency" | "timeZone", string>>;

export default function BusinessSetupScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const businesses = useQuery(businessesQueryOptions);
  const [name, setName] = useState("");
  const [currencyChoice, setCurrencyChoice] = useState<string | null>(null);
  const [otherCurrency, setOtherCurrency] = useState("");
  const [timeZoneChoice, setTimeZoneChoice] = useState<string>(
    isListedTimeZone(detectedTimeZone) ? detectedTimeZone : OTHER_OPTION,
  );
  const [otherTimeZone, setOtherTimeZone] = useState(
    isListedTimeZone(detectedTimeZone) ? "" : detectedTimeZone,
  );
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
  const currency = currencyChoice === OTHER_OPTION ? otherCurrency : (currencyChoice ?? "");
  const timeZone = timeZoneChoice === OTHER_OPTION ? otherTimeZone : timeZoneChoice;

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

  if (businesses.fetchStatus === "paused" && !businesses.data) {
    return (
      <Page width="reading">
        <OfflineState />
      </Page>
    );
  }

  if (businesses.isPending) {
    return (
      <Page width="reading">
        <ContentSkeleton label={t("business.loading")} variant="form" />
      </Page>
    );
  }

  const existing = businesses.data?.items ?? [];

  return (
    <Page contentContainerClassName="max-w-[520px] gap-6" width="reading">
      <PageHeader
        description={existing.length ? t("business.chooseDescription") : t("business.description")}
        title={existing.length ? t("business.chooseTitle") : t("business.title")}
      />

      {businesses.isError && businesses.data ? (
        <StaleNotice onRetry={() => businesses.refetch()} />
      ) : null}

      {businesses.isError && !businesses.data ? (
        <StatePanel
          action={
            <Button
              label={t("common.retry")}
              onPress={() => businesses.refetch()}
              size="sm"
              variant="outline"
            />
          }
          description={t("business.loadFailed")}
          icon={TriangleAlert}
          level={2}
          title={t("business.loadFailedTitle")}
          tone="destructive"
        />
      ) : existing.length > 0 ? (
        <View className="gap-3">
          <View className="overflow-hidden rounded-lg border border-border bg-card">
            {existing.map((business, index) => (
              <View
                className={`flex-row items-center gap-3 px-3 py-2.5 ${index > 0 ? "border-t border-border" : ""}`}
                key={business.id}
              >
                <Avatar alt={business.name} className="size-8">
                  <AvatarFallback className="bg-foreground">
                    <Text className="font-heading text-xs text-background">
                      {initialsOf(business.name)}
                    </Text>
                  </AvatarFallback>
                </Avatar>
                <View className="min-w-0 flex-1">
                  <Text className="font-ui text-sm" numberOfLines={1}>
                    {business.name}
                  </Text>
                  <Text className="text-xs text-muted-foreground">{business.currency}</Text>
                </View>
                <Button
                  accessibilityLabel={t("business.continueWith", { name: business.name })}
                  disabled={selection.isPending}
                  loading={selection.isPending && selection.variables === business.id}
                  onPress={() => selection.mutate(business.id)}
                  size="sm"
                  variant={index === 0 ? "default" : "outline"}
                >
                  <Text>{t("business.continue")}</Text>
                  <Icon as={ArrowRight} size={14} />
                </Button>
              </View>
            ))}
          </View>
          {selection.error ? (
            <Alert icon={CircleAlert} variant="destructive">
              <AlertDescription>{t("business.continueFailed")}</AlertDescription>
            </Alert>
          ) : null}
        </View>
      ) : (
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
          <View className="gap-1.5">
            <SelectField
              disabled={creationLocked}
              error={currencyChoice === OTHER_OPTION ? undefined : errors.currency}
              label={t("business.currency")}
              onChange={setCurrencyChoice}
              options={[
                ...BUSINESS_CURRENCIES.map((code) => ({
                  label: `${code} · ${t(`business.currencies.${code}`)}`,
                  value: code,
                })),
                { label: t("business.otherCurrency"), value: OTHER_OPTION },
              ]}
              placeholder={t("business.currencyPlaceholder")}
              value={currencyChoice}
            />
            {currencyChoice === OTHER_OPTION ? (
              <Field
                autoCapitalize="characters"
                description={t("business.otherCurrencyHint")}
                editable={!creationLocked}
                error={errors.currency}
                label={t("business.currencyCode")}
                maxLength={3}
                onChangeText={setOtherCurrency}
                value={otherCurrency}
              />
            ) : null}
          </View>
          <View className="gap-1.5">
            <SelectField
              disabled={creationLocked}
              error={timeZoneChoice === OTHER_OPTION ? undefined : errors.timeZone}
              label={t("business.timeZone")}
              onChange={setTimeZoneChoice}
              options={[
                ...BUSINESS_TIME_ZONES.map((zone) => ({
                  label: t(`business.timeZones.${zone}`),
                  value: zone,
                })),
                { label: t("business.otherTimeZone"), value: OTHER_OPTION },
              ]}
              value={timeZoneChoice}
            />
            {timeZoneChoice === OTHER_OPTION ? (
              <Field
                autoCapitalize="none"
                description={t("business.otherTimeZoneHint")}
                editable={!creationLocked}
                error={errors.timeZone}
                label={t("business.timeZoneCode")}
                onChangeText={setOtherTimeZone}
                value={otherTimeZone}
              />
            ) : null}
          </View>

          <View className="flex-row items-start gap-3 rounded-lg border border-border bg-card px-3 py-3">
            <Checkbox
              accessibilityLabel={t("business.acknowledgment")}
              aria-labelledby="business-acknowledgment-label"
              checked={acknowledged}
              className="mt-0.5"
              disabled={creationLocked}
              nativeID="business-acknowledgment"
              onCheckedChange={(checked) => {
                if (!creationLocked) setAcknowledged(checked);
              }}
            />
            <Label
              className="min-w-0 flex-1 text-[13px] leading-5"
              disabled={creationLocked}
              nativeID="business-acknowledgment-label"
              onPress={() => {
                if (!creationLocked) setAcknowledged((value) => !value);
              }}
            >
              {t("business.acknowledgment")}
            </Label>
          </View>

          {creation.error ? (
            <Alert
              icon={uncertainCreation ? TriangleAlert : CircleAlert}
              variant={uncertainCreation ? "warning" : "destructive"}
            >
              {uncertainCreation ? <AlertTitle>{t("common.uncertainTitle")}</AlertTitle> : null}
              <AlertDescription>
                {uncertainCreation
                  ? t("business.uncertain")
                  : productErrorMessage(creation.error, t("business.createFailed"), t, "business")}
              </AlertDescription>
            </Alert>
          ) : null}

          <Button
            className="w-full"
            disabled={!acknowledged || name.trim().length < 2}
            label={uncertainCreation ? t("common.retrySameConfirmation") : t("business.create")}
            loading={creation.isPending}
            onPress={createBusiness}
            size="lg"
          />
          <Text className="text-xs leading-4 text-muted-foreground">
            {t("business.incrementNote")}
          </Text>
        </View>
      )}
    </Page>
  );
}
