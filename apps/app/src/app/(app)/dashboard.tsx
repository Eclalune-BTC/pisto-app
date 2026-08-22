import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  CreditCard,
  Goal,
  Landmark,
  RefreshCw,
} from "lucide-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";

import { ScreenHeader } from "@/components/screen-header";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonText } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";

const setupItems = [
  {
    icon: Landmark,
    title: "Connect an account",
    description: "Bring in the account you use most often.",
    status: "Ready",
  },
  {
    icon: CircleDollarSign,
    title: "Set a monthly target",
    description: "Choose one number that feels realistic.",
    status: "Next",
  },
  {
    icon: Goal,
    title: "Name your first goal",
    description: "Turn an intention into something visible.",
    status: "Later",
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
                  ? "Working offline"
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
        <View className="min-w-0 flex-[1.45] overflow-hidden rounded-[28px] bg-ink p-6 sm:p-8">
          <View className="absolute -right-14 -top-14 h-48 w-48 rounded-full bg-[#29483B]" />
          <View className="absolute -bottom-20 right-20 h-44 w-44 rounded-full bg-[#1C372D]" />
          <View className="relative gap-7">
            <View className="flex-row items-start justify-between gap-4">
              <View className="max-w-[500px] gap-3">
                <Badge className="bg-accent" tone="positive">
                  START HERE
                </Badge>
                <Text className="text-[28px] font-black leading-[34px] tracking-[-1px] text-white sm:text-[34px] sm:leading-[40px]">
                  Build a useful plan in a few small moves.
                </Text>
                <Text className="text-base leading-6 text-[#B6C7BE]">
                  No complete financial picture is required. Add only what helps you decide what to
                  do next.
                </Text>
              </View>
              <View className="hidden h-14 w-14 items-center justify-center rounded-full bg-accent sm:flex">
                <CheckCircle2 color="#14241D" size={27} strokeWidth={2.4} />
              </View>
            </View>
            <View className="h-2 overflow-hidden rounded-full bg-[#365046]">
              <View className="h-full w-1/3 rounded-full bg-accent" />
            </View>
            <View className="flex-row items-center justify-between gap-4">
              <Text className="text-sm font-bold text-[#B6C7BE]">1 of 3 setup steps ready</Text>
              <Button onPress={() => router.push("/settings")} size="sm" variant="accent">
                <ButtonText variant="accent">Continue setup</ButtonText>
                <ArrowRight color="#14241D" size={16} strokeWidth={2.5} />
              </Button>
            </View>
          </View>
        </View>

        <Card className="flex-1 justify-between gap-7 p-6 sm:p-7">
          <View className="flex-row items-center justify-between">
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-[#E9F6EE] dark:bg-[#224634]">
              <CreditCard color="#237A55" size={23} />
            </View>
            <Badge tone="neutral">PLAN</Badge>
          </View>
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
        <View className="flex-row items-end justify-between">
          <View className="gap-1">
            <Text className="text-xl font-black tracking-[-0.5px] text-ink dark:text-white">
              Your next steps
            </Text>
            <Text className="text-sm text-ink-muted dark:text-[#AAB8B0]">
              A short list, on purpose.
            </Text>
          </View>
          <Text className="text-xs font-bold uppercase tracking-[1.2px] text-positive dark:text-[#8DDEAF]">
            3 items
          </Text>
        </View>
        <View className="gap-4 md:flex-row">
          {setupItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <Card key={item.title} className="flex-1 gap-5 p-5">
                <View className="flex-row items-center justify-between">
                  <View className="h-11 w-11 items-center justify-center rounded-2xl bg-[#EDF3EE] dark:bg-[#24372E]">
                    <Icon color="#237A55" size={21} />
                  </View>
                  <Badge tone={index === 0 ? "positive" : "neutral"}>{item.status}</Badge>
                </View>
                <View className="gap-1.5">
                  <CardTitle>{item.title}</CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </View>
              </Card>
            );
          })}
        </View>
      </View>

      <Card className="gap-5 p-6">
        <View className="gap-1">
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>Your latest Pisto changes will appear here.</CardDescription>
        </View>
        <View className="items-center gap-3 rounded-[20px] border border-dashed border-line bg-[#FAFBF9] px-5 py-9 dark:border-[#3A4B42] dark:bg-[#14241D]">
          <View className="h-12 w-12 items-center justify-center rounded-full bg-[#EAF2EB] dark:bg-[#263A31]">
            <CheckCircle2 color="#617168" size={22} />
          </View>
          <Text className="text-base font-bold text-ink dark:text-white">
            Nothing to catch up on
          </Text>
          <Text className="max-w-[420px] text-center text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
            Once you make changes to your plan, this space will keep the important moments easy to
            find.
          </Text>
        </View>
      </Card>
    </ScrollView>
  );
}
