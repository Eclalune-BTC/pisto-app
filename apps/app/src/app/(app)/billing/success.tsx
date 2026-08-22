import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AlertCircle, CheckCircle2, Clock3, RefreshCw } from "lucide-react-native";
import { useEffect } from "react";
import { ScrollView, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api-client";

export default function BillingSuccessScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { checkout_id: checkoutId } = useLocalSearchParams<{ checkout_id?: string }>();
  const entitlements = useQuery({
    queryFn: api.billing.entitlements,
    queryKey: ["billing", "entitlements"],
  });
  const hasActiveAccess =
    entitlements.data?.items.some((item) => item.status === "active") ?? false;
  const accessState = entitlements.isPending
    ? "pending"
    : entitlements.isError
      ? "error"
      : hasActiveAccess
        ? "active"
        : "inactive";

  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: ["billing"] });
  }, [queryClient]);

  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="mx-auto w-full max-w-[720px] flex-grow items-center justify-center px-5 py-10 sm:px-8"
      showsVerticalScrollIndicator={false}
    >
      <Card className="w-full items-center gap-6 p-7 sm:p-10">
        <View
          className={`h-16 w-16 items-center justify-center rounded-full ${accessState === "active" ? "bg-[#DCF4E6] dark:bg-[#214533]" : accessState === "error" ? "bg-[#FBE6E6] dark:bg-[#4B2929]" : "bg-[#FFF0DA] dark:bg-[#4A3320]"}`}
        >
          {accessState === "active" ? (
            <CheckCircle2 color="#237A55" size={30} strokeWidth={2.4} />
          ) : accessState === "error" ? (
            <AlertCircle color="#B94242" size={30} strokeWidth={2.4} />
          ) : (
            <Clock3 color="#B86718" size={30} strokeWidth={2.4} />
          )}
        </View>
        <View className="items-center gap-2">
          <Text className="text-xs font-extrabold uppercase tracking-[1.6px] text-positive dark:text-[#8DDEAF]">
            Back in Pisto
          </Text>
          <CardTitle className="text-center text-[30px] leading-[36px]">
            {accessState === "active"
              ? "Your access is ready"
              : accessState === "error"
                ? "We could not verify your access"
                : accessState === "inactive"
                  ? "Access is not active yet"
                  : "We are confirming your access"}
          </CardTitle>
          <CardDescription className="max-w-[520px] text-center text-base leading-6">
            {accessState === "active"
              ? "The latest entitlement is now attached to your account."
              : accessState === "error"
                ? "Checkout returned safely, but the entitlement service could not be reached. Pisto will not assume a successful purchase."
                : accessState === "inactive"
                  ? "The server has not reported active access. Refresh again shortly or return to billing for the current account state."
                  : "Checkout returned safely. Pisto is refreshing the server-backed billing state before showing access as active."}
          </CardDescription>
          {checkoutId ? (
            <Text className="mt-1 text-center text-xs text-[#819087] dark:text-[#82938A]">
              A checkout return reference was received for this refresh.
            </Text>
          ) : null}
        </View>
        <View className="w-full gap-3 sm:flex-row sm:justify-center">
          <Button
            className="sm:min-w-[180px]"
            label="Back to billing"
            onPress={() => router.replace("/billing")}
          />
          {accessState !== "active" ? (
            <Button
              className="sm:min-w-[180px]"
              loading={entitlements.isFetching}
              onPress={() => entitlements.refetch()}
              variant="secondary"
            >
              <RefreshCw color="#617168" size={16} />
              <Text className="text-[15px] font-bold text-ink dark:text-white">Refresh status</Text>
            </Button>
          ) : null}
        </View>
      </Card>
    </ScrollView>
  );
}
