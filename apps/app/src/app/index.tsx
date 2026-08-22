import { useRouter } from "expo-router";
import { ArrowRight } from "lucide-react-native";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Brand } from "@/components/brand";
import { Button, ButtonText } from "@/components/ui/button";

const featureItems = [
  {
    title: "A clear starting point",
    description: "Bring the pieces of your financial life into one calm, organized view.",
  },
  {
    title: "Less financial noise",
    description: "See the next useful action without digging through dense charts or menus.",
  },
  {
    title: "Security by design",
    description: "Sessions are protected with secure, platform-aware storage on mobile.",
  },
] as const;

const previewItems = [
  {
    title: "Choose what matters",
    description: "Focus the plan on the accounts, goals, and decisions that are useful to you.",
  },
  {
    title: "Make the next decision clear",
    description: "Keep one practical action visible instead of adding more financial noise.",
  },
  {
    title: "Review when you need to",
    description: "Return to the plan when your priorities or circumstances change.",
  },
] as const;

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-ink">
      <SafeAreaView className="flex-1" edges={["top", "left", "right"]}>
        <ScrollView contentContainerClassName="flex-grow" showsVerticalScrollIndicator={false}>
          <View className="mx-auto w-full max-w-[1200px] px-5 pb-10 pt-4 sm:px-8 lg:px-12">
            <View className="min-h-16 flex-row items-center justify-between">
              <Brand inverse />
              <View className="flex-row items-center gap-2">
                <Button
                  accessibilityLabel="Sign in"
                  className="hidden sm:flex"
                  onPress={() => router.push("/sign-in")}
                  size="sm"
                  variant="ghost"
                >
                  <ButtonText className="text-white" variant="ghost">
                    Sign in
                  </ButtonText>
                </Button>
                <Button onPress={() => router.push("/sign-up")} size="sm" variant="accent">
                  <ButtonText variant="accent">Get started</ButtonText>
                  <ArrowRight color="#14241D" size={16} strokeWidth={2.5} />
                </Button>
              </View>
            </View>

            <View className="gap-12 py-14 lg:min-h-[620px] lg:flex-row lg:items-center lg:gap-16 lg:py-12">
              <View className="flex-1 gap-8">
                <Text className="self-start text-sm font-bold text-accent">
                  Your money, made clearer
                </Text>
                <View className="gap-5">
                  <Text className="max-w-[660px] text-[48px] font-black leading-[51px] tracking-[-2.4px] text-white sm:text-[64px] sm:leading-[66px]">
                    Feel good about what comes next.
                  </Text>
                  <Text className="max-w-[590px] text-lg leading-7 text-[#BFD0C6] sm:text-xl sm:leading-8">
                    Pisto turns scattered money decisions into a simple plan you can understand and
                    act on.
                  </Text>
                </View>
                <View className="gap-3 sm:flex-row">
                  <Button onPress={() => router.push("/sign-up")} size="lg" variant="accent">
                    <ButtonText variant="accent">Create your account</ButtonText>
                    <ArrowRight color="#14241D" size={18} strokeWidth={2.5} />
                  </Button>
                  <Button
                    className="border border-[#496155] bg-[#1B332A]"
                    label="I already use Pisto"
                    onPress={() => router.push("/sign-in")}
                    size="lg"
                    variant="primary"
                  />
                </View>
                <View className="flex-row flex-wrap gap-x-5 gap-y-2">
                  {["No card to begin", "Private by default", "Built for every screen"].map(
                    (item) => (
                      <Text key={item} className="text-sm font-semibold text-[#BFD0C6]">
                        {item}
                      </Text>
                    ),
                  )}
                </View>
              </View>

              <View className="w-full self-center sm:max-w-[520px] lg:w-[420px] lg:max-w-none">
                <View className="border border-[#4A6257] bg-[#F1F5EF]">
                  <View className="gap-2 border-b border-[#D5DED6] p-6">
                    <Text className="text-xs font-bold uppercase tracking-[1.4px] text-[#617168]">
                      Illustrative preview
                    </Text>
                    <Text className="text-[28px] font-black leading-[34px] tracking-[-0.8px] text-ink">
                      A simple planning flow
                    </Text>
                    <Text className="text-sm leading-5 text-ink-muted">
                      This example shows how Pisto can organize a decision. It does not represent an
                      account or saved progress.
                    </Text>
                  </View>
                  <View className="px-6">
                    {previewItems.map((item, index) => (
                      <View
                        key={item.title}
                        className={`gap-1 py-5 ${index > 0 ? "border-t border-[#D5DED6]" : ""}`}
                      >
                        <Text className="text-base font-bold text-ink">{item.title}</Text>
                        <Text className="text-sm leading-5 text-ink-muted">{item.description}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            </View>

            <View className="border-t border-[#385247] pt-2 sm:flex-row">
              {featureItems.map((item, index) => (
                <View
                  key={item.title}
                  className={`flex-1 gap-2 py-6 ${
                    index < featureItems.length - 1
                      ? "border-b border-[#385247] sm:border-b-0 sm:border-r sm:pr-6"
                      : ""
                  } ${index > 0 ? "sm:pl-6" : ""}`}
                >
                  <Text className="text-base font-bold text-white">{item.title}</Text>
                  <Text className="text-sm leading-5 text-[#AFC0B6]">{item.description}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
