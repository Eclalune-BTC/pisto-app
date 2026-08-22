import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  ArrowRight,
  CircleDollarSign,
  CreditCard,
  Goal,
  Landmark,
  RefreshCw,
} from "lucide-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";

import { ScreenHeader } from "@/components/screen-header";
import { Button, ButtonText } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";

const setupItems = [
  {
    icon: Landmark,
    title: "Choose what belongs in the plan",
    description: "Decide which accounts and obligations are relevant to the decision ahead.",
  },
  {
    icon: CircleDollarSign,
    title: "Set a monthly target",
    description: "Choose a number you can revisit when your circumstances change.",
  },
  {
    icon: Goal,
    title: "Describe the goal",
    description: "Write down what you want the plan to help you accomplish.",
  },
] as const;

export default function DashboardScreen() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const health = useQuery({
    queryFn: api.health,
    queryKey: ["api", "health"],
    refetchInterval: 60_000,
  });
  const firstName = session?.user.name?.split(" ")[0] || "there";

  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="mx-auto w-full max-w-[1180px] gap-8 px-5 py-7 sm:px-8 sm:py-10 lg:px-12"
      showsVerticalScrollIndicator={false}
    >
      <ScreenHeader
        action={
          <View className="flex-row items-center gap-2">
            <View
              className={`h-2.5 w-2.5 rounded-full ${health.isSuccess ? "bg-positive" : health.isError ? "bg-warning" : "bg-[#9AA79F]"}`}
            />
            <Text className="text-xs font-bold text-ink-muted dark:text-[#AAB8B0]">
              {health.isSuccess
                ? "Pisto is connected"
                : health.isError
                  ? "Service unavailable"
                  : "Checking connection"}
            </Text>
            {health.isError ? (
              <Pressable accessibilityLabel="Retry connection" onPress={() => health.refetch()}>
                <RefreshCw color="#617168" size={15} />
              </Pressable>
            ) : null}
          </View>
        }
        description="Start with one useful step. The rest can wait."
        eyebrow="Your overview"
        title={`Welcome back, ${firstName}`}
      />

      <View className="gap-5 lg:flex-row">
        <View className="min-w-0 flex-[1.45] border-l-4 border-accent bg-ink p-6 sm:p-8">
          <View className="max-w-[620px] gap-6">
            <View className="gap-3">
              <Text className="text-[28px] font-black leading-[34px] tracking-[-1px] text-white sm:text-[34px] sm:leading-[40px]">
                Build a useful plan in a few small moves.
              </Text>
              <Text className="text-base leading-6 text-[#B6C7BE]">
                No complete financial picture is required. Add only what helps you decide what to do
                next.
              </Text>
            </View>
            <Button
              className="self-start"
              onPress={() => router.push("/settings")}
              size="sm"
              variant="accent"
            >
              <ButtonText variant="accent">Review account settings</ButtonText>
              <ArrowRight color="#14241D" size={16} strokeWidth={2.5} />
            </Button>
          </View>
        </View>

        <Card className="flex-1 justify-between gap-7 p-6 sm:p-7">
          <CreditCard color="#237A55" size={23} />
          <View className="gap-2">
            <CardTitle className="text-2xl">Your current access</CardTitle>
            <CardDescription>
              Review what is included and manage access from the billing screen.
            </CardDescription>
          </View>
          <Button
            label="View billing"
            onPress={() => router.push("/billing")}
            variant="secondary"
          />
        </Card>
      </View>

      <View className="gap-4">
        <View className="gap-1">
          <Text className="text-xl font-black tracking-[-0.5px] text-ink dark:text-white">
            Getting started
          </Text>
          <Text className="text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
            These are planning suggestions, not saved progress or completed tasks.
          </Text>
        </View>
        <View className="border-y border-line dark:border-[#304239] md:flex-row">
          {setupItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <View
                key={item.title}
                className={`flex-1 flex-row gap-4 py-5 ${
                  index < setupItems.length - 1
                    ? "border-b border-line dark:border-[#304239] md:border-b-0 md:border-r md:pr-6"
                    : ""
                } ${index > 0 ? "md:pl-6" : ""}`}
              >
                <Icon color="#237A55" size={21} />
                <View className="min-w-0 flex-1 gap-1.5">
                  <CardTitle>{item.title}</CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      <Card className="gap-5 p-6">
        <View className="gap-1">
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>Your latest Pisto changes will appear here.</CardDescription>
        </View>
        <View className="gap-2 border-t border-line pt-5 dark:border-[#304239]">
          <Text className="text-base font-bold text-ink dark:text-white">No activity yet</Text>
          <Text className="max-w-[560px] text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
            Once you make changes to your plan, this space will keep the important moments easy to
            find.
          </Text>
        </View>
      </Card>
    </ScrollView>
  );
}
