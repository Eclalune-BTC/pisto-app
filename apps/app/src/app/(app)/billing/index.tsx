import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, Check, ExternalLink, ShieldCheck, Sparkles } from "lucide-react-native";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { ScreenHeader } from "@/components/screen-header";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonText } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import { platformBilling } from "@/lib/billing/platform-billing";

const includedItems = [
  "A focused money overview",
  "Goals and planning workspace",
  "Secure access across supported devices",
] as const;

export default function BillingScreen() {
  const [notice, setNotice] = useState<string>();
  const catalog = useQuery({
    queryFn: api.billing.catalog,
    queryKey: ["billing", "catalog"],
  });
  const entitlements = useQuery({
    queryFn: api.billing.entitlements,
    queryKey: ["billing", "entitlements"],
  });
  const product = catalog.data?.products[0];
  const activeEntitlements =
    entitlements.data?.items.filter((item) => item.status === "active") ?? [];
  const webCheckout = platformBilling.capabilities.channel === "web-checkout";

  const purchase = useMutation({
    mutationFn: async () => {
      if (!product) throw new Error("No billing product is currently available.");
      return platformBilling.purchase(product.slug);
    },
    onError: (error) => {
      setNotice(error instanceof Error ? error.message : "Checkout could not be opened.");
    },
    onSuccess: (result) => {
      if (result.status === "unavailable") setNotice(result.message);
    },
  });

  const manage = useMutation({
    mutationFn: platformBilling.manage,
    onError: (error) => {
      setNotice(error instanceof Error ? error.message : "Billing management could not be opened.");
    },
    onSuccess: (result) => {
      if (result.status === "unavailable") setNotice(result.message);
    },
  });

  const catalogEnabled = catalog.data?.status === "enabled";
  const canPurchase =
    platformBilling.capabilities.canPurchase && catalogEnabled && Boolean(product);

  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="mx-auto w-full max-w-[1080px] gap-8 px-5 py-7 sm:px-8 sm:py-10 lg:px-12"
      showsVerticalScrollIndicator={false}
    >
      <ScreenHeader
        description="See your access and use the purchase flow designed for this platform."
        eyebrow="Billing"
        title="Simple access, clear controls"
      />

      {notice ? (
        <View className="flex-row items-start gap-3 rounded-[20px] border border-[#F2D5AC] bg-[#FFF8EC] p-4 dark:border-[#60472C] dark:bg-[#392B1C]">
          <AlertCircle color="#B86718" size={20} />
          <Text className="min-w-0 flex-1 text-sm font-semibold leading-5 text-warning dark:text-[#F6BB76]">
            {notice}
          </Text>
        </View>
      ) : null}

      <View className="gap-5 lg:flex-row">
        <Card className="flex-1 gap-6 p-6 sm:p-7">
          <View className="flex-row items-center justify-between">
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-[#EAF4EC] dark:bg-[#244334]">
              <ShieldCheck color="#237A55" size={24} />
            </View>
            <Badge
              tone={
                entitlements.isError
                  ? "warning"
                  : activeEntitlements.length > 0
                    ? "positive"
                    : "neutral"
              }
            >
              {entitlements.isPending
                ? "CHECKING"
                : entitlements.isError
                  ? "UNKNOWN"
                  : activeEntitlements.length > 0
                    ? "ACTIVE"
                    : "STANDARD"}
            </Badge>
          </View>
          <View className="gap-2">
            <CardTitle className="text-2xl">Current access</CardTitle>
            <CardDescription>
              {entitlements.isPending
                ? "Pisto is checking your server-backed access."
                : entitlements.isError
                  ? "Pisto could not verify your current access. No access state is being assumed."
                  : activeEntitlements.length > 0
                    ? `${activeEntitlements.length} active entitlement${activeEntitlements.length === 1 ? "" : "s"} found for your account.`
                    : "Your account is using the standard Pisto experience."}
            </CardDescription>
          </View>
          {entitlements.isError ? (
            <Button
              label="Retry access check"
              loading={entitlements.isFetching}
              onPress={() => entitlements.refetch()}
              variant="secondary"
            />
          ) : null}
          <View className="gap-2">
            {activeEntitlements.slice(0, 3).map((item) => (
              <View
                key={item.key}
                className="flex-row items-center justify-between rounded-2xl bg-[#F2F6F2] p-3 dark:bg-[#14241D]"
              >
                <Text className="font-bold text-ink dark:text-white">{item.key}</Text>
                <Badge tone="positive">{item.status}</Badge>
              </View>
            ))}
          </View>
          <Button
            disabled={!platformBilling.capabilities.canManage}
            label={webCheckout ? "Manage billing" : "Store management unavailable"}
            loading={manage.isPending}
            onPress={() => manage.mutate()}
            variant="secondary"
          />
        </Card>

        <View className="flex-[1.2] overflow-hidden rounded-[28px] bg-ink p-6 sm:p-8">
          <View className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-[#29483B]" />
          <View className="relative gap-7">
            <View className="flex-row items-start justify-between gap-4">
              <View className="min-w-0 flex-1 gap-2">
                <Badge className="bg-accent">{webCheckout ? "WEB PLAN" : "NATIVE ACCESS"}</Badge>
                <Text className="text-[30px] font-black leading-[36px] tracking-[-1px] text-white">
                  {catalog.isPending
                    ? "Loading plan details"
                    : catalog.isError
                      ? "Plan status unavailable"
                      : product?.name || "Pisto Plus"}
                </Text>
                <Text className="text-base leading-6 text-[#B6C7BE]">
                  {catalog.isError
                    ? "Pisto could not verify the current catalog. Retry before making a purchase decision."
                    : product?.description ||
                      "A focused upgrade for people who want more room to plan and stay organized."}
                </Text>
              </View>
              <View className="h-12 w-12 items-center justify-center rounded-full bg-accent">
                <Sparkles color="#14241D" size={22} />
              </View>
            </View>

            <View className="gap-3">
              {includedItems.map((item) => (
                <View key={item} className="flex-row items-center gap-3">
                  <View className="h-6 w-6 items-center justify-center rounded-full bg-[#2A4B3E]">
                    <Check color="#D9FB67" size={14} strokeWidth={3} />
                  </View>
                  <Text className="min-w-0 flex-1 text-sm font-semibold text-[#DCE7E1]">
                    {item}
                  </Text>
                </View>
              ))}
            </View>

            {webCheckout ? (
              <View className="gap-3">
                {catalog.isError ? (
                  <Button
                    label="Retry plan status"
                    loading={catalog.isFetching}
                    onPress={() => catalog.refetch()}
                    variant="accent"
                  />
                ) : (
                  <Button
                    disabled={!canPurchase}
                    loading={purchase.isPending}
                    onPress={() => purchase.mutate()}
                    variant="accent"
                  >
                    <ButtonText variant="accent">
                      {catalog.isPending
                        ? "Loading plan"
                        : catalogEnabled
                          ? "Continue to secure checkout"
                          : "Checkout unavailable"}
                    </ButtonText>
                    <ExternalLink color="#14241D" size={16} strokeWidth={2.4} />
                  </Button>
                )}
                <Text className="text-center text-xs leading-5 text-[#9EB1A7]">
                  Web checkout opens only after Pisto creates an authenticated session on the
                  server.
                </Text>
              </View>
            ) : (
              <View className="gap-3 rounded-[20px] border border-[#41594E] bg-[#1B332A] p-4">
                <Text className="font-bold text-white">Native store adapter pending</Text>
                <Text className="text-sm leading-5 text-[#AFC0B6]">
                  This build does not send you to an external checkout. Connect an App Store or Play
                  billing adapter before enabling native purchases.
                </Text>
                <Button disabled label="Purchases unavailable in this build" variant="secondary" />
              </View>
            )}
          </View>
        </View>
      </View>

      <Card className="gap-3 p-6">
        <CardTitle>How billing works here</CardTitle>
        <CardDescription>
          On the web, Pisto asks the authenticated API to create checkout or portal sessions. On iOS
          and Android, this build exposes only a provider-neutral store state until a native in-app
          purchase adapter is configured.
        </CardDescription>
      </Card>
    </ScrollView>
  );
}
