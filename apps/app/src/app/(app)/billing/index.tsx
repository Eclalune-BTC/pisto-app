import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, ExternalLink } from "lucide-react-native";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { ScreenHeader } from "@/components/screen-header";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonText } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import { platformBilling } from "@/lib/billing/platform-billing";

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
  const billingChannel = platformBilling.capabilities.channel;
  const webCheckout = billingChannel === "web-checkout";
  const nativeBilling = billingChannel === "native-store-placeholder";

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
          <View className="flex-row items-start justify-between gap-4">
            <View className="min-w-0 flex-1 gap-2">
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
                ? "Checking"
                : entitlements.isError
                  ? "Unknown"
                  : activeEntitlements.length > 0
                    ? "Active"
                    : "Standard"}
            </Badge>
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
                className="flex-row items-center justify-between border-t border-line py-3 dark:border-[#304239]"
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

        <View className="flex-[1.2] gap-7 rounded-2xl bg-ink p-6 sm:p-8">
          <View className="gap-2 border-l-4 border-accent pl-5">
            <Text className="text-sm font-bold text-accent">
              {webCheckout
                ? "Web subscription"
                : nativeBilling
                  ? "Native access"
                  : "Billing unavailable"}
            </Text>
            <Text className="text-[30px] font-black leading-[36px] tracking-[-1px] text-white">
              {catalog.isPending
                ? "Loading plan details"
                : catalog.isError
                  ? "Plan details unavailable"
                  : product?.name
                    ? product.name
                    : catalogEnabled
                      ? "No plan available"
                      : "Checkout is not configured"}
            </Text>
            {catalog.isError ? (
              <Text className="text-base leading-6 text-[#B6C7BE]">
                Pisto could not verify the current catalog. Retry before making a purchase decision.
              </Text>
            ) : product?.description ? (
              <Text className="text-base leading-6 text-[#B6C7BE]">{product.description}</Text>
            ) : !catalog.isPending ? (
              <Text className="text-base leading-6 text-[#B6C7BE]">
                {catalogEnabled
                  ? "The server did not return a purchasable plan."
                  : "Web checkout remains unavailable until the billing catalog is enabled."}
              </Text>
            ) : null}
          </View>

          {webCheckout ? (
            <View className="gap-3 border-t border-[#41594E] pt-5">
              {catalog.isError ? (
                <Button
                  label="Retry plan status"
                  loading={catalog.isFetching}
                  onPress={() => catalog.refetch()}
                  variant="accent"
                />
              ) : canPurchase ? (
                <Button
                  loading={purchase.isPending}
                  onPress={() => purchase.mutate()}
                  variant="accent"
                >
                  <ButtonText variant="accent">Continue to secure checkout</ButtonText>
                  <ExternalLink color="#14241D" size={16} strokeWidth={2.4} />
                </Button>
              ) : (
                <Text className="text-sm leading-5 text-[#AFC0B6]">
                  There is no checkout action available for the current catalog state.
                </Text>
              )}
              <Text className="text-xs leading-5 text-[#9EB1A7]">
                Checkout opens only after Pisto creates an authenticated server session.
              </Text>
            </View>
          ) : nativeBilling ? (
            <View className="gap-2 border-t border-[#41594E] pt-5">
              <Text className="font-bold text-white">Native purchases are not enabled</Text>
              <Text className="text-sm leading-5 text-[#AFC0B6]">
                This build does not open an external checkout. An App Store or Play billing adapter
                must be connected before native purchases are offered.
              </Text>
            </View>
          ) : (
            <View className="gap-2 border-t border-[#41594E] pt-5">
              <Text className="font-bold text-white">Platform adapter could not be resolved</Text>
              <Text className="text-sm leading-5 text-[#AFC0B6]">
                This build did not select its web or native billing implementation. Billing actions
                remain disabled until the build configuration is corrected.
              </Text>
            </View>
          )}
        </View>
      </View>

      <View className="gap-2 border-t border-line pt-6 dark:border-[#304239]">
        <Text className="font-bold text-ink dark:text-white">How billing works here</Text>
        <Text className="text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
          On the web, Pisto asks the authenticated API to create checkout or portal sessions. On iOS
          and Android, this build exposes only a provider-neutral store state until a native in-app
          purchase adapter is configured.
        </Text>
      </View>
    </ScrollView>
  );
}
