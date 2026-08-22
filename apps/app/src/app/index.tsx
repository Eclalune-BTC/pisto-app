import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ArrowRight, Check, LockKeyhole, Sparkles, WalletCards } from "lucide-react-native";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Brand } from "@/components/brand";
import { Button, ButtonText } from "@/components/ui/button";

const featureItems = [
  {
    icon: WalletCards,
    title: "A clear starting point",
    description: "Bring the pieces of your financial life into one calm, organized view.",
  },
  {
    icon: Sparkles,
    title: "Less financial noise",
    description: "See the next useful action without digging through dense charts or menus.",
  },
  {
    icon: LockKeyhole,
    title: "Security by design",
    description: "Sessions are protected with secure, platform-aware storage on mobile.",
  },
] as const;

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-ink">
      <LinearGradient
        colors={["#132A22", "#1B392E", "#132A22"]}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
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
                <View className="self-start flex-row items-center gap-2 rounded-full border border-[#496155] bg-[#203C31] px-4 py-2">
                  <View className="h-2 w-2 rounded-full bg-accent" />
                  <Text className="text-xs font-extrabold uppercase tracking-[1.4px] text-[#D9E5DE]">
                    Your money, made clearer
                  </Text>
                </View>
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
                      <View key={item} className="flex-row items-center gap-2">
                        <View className="h-5 w-5 items-center justify-center rounded-full bg-[#2A4B3E]">
                          <Check color="#D9FB67" size={12} strokeWidth={3} />
                        </View>
                        <Text className="text-sm font-semibold text-[#BFD0C6]">{item}</Text>
                      </View>
                    ),
                  )}
                </View>
              </View>

              <View className="w-full self-center sm:max-w-[520px] lg:w-[420px] lg:max-w-none">
                <View className="rotate-[-2deg] rounded-[32px] border border-[#4A6257] bg-[#F1F5EF] p-4 shadow-2xl">
                  <View className="gap-5 rounded-[24px] bg-white p-6">
                    <View className="flex-row items-center justify-between">
                      <View className="gap-1">
                        <Text className="text-xs font-bold uppercase tracking-[1.4px] text-[#728179]">
                          Today
                        </Text>
                        <Text className="text-xl font-black tracking-[-0.6px] text-ink">
                          Your money plan
                        </Text>
                      </View>
                      <View className="h-11 w-11 items-center justify-center rounded-full bg-accent">
                        <Sparkles color="#14241D" size={20} />
                      </View>
                    </View>
                    <View className="rounded-[22px] bg-ink p-5">
                      <Text className="text-sm font-semibold text-[#ABC0B4]">
                        Ready for your next goal
                      </Text>
                      <Text className="mt-2 text-[34px] font-black tracking-[-1.3px] text-white">
                        Start small
                      </Text>
                      <View className="mt-5 h-2 overflow-hidden rounded-full bg-[#365046]">
                        <View className="h-full w-[62%] rounded-full bg-accent" />
                      </View>
                      <Text className="mt-2 text-xs text-[#ABC0B4]">One step at a time</Text>
                    </View>
                    <View className="gap-3">
                      {[
                        ["Connect your first account", "2 min"],
                        ["Choose one monthly goal", "Next"],
                        ["Review your plan", "Weekly"],
                      ].map(([label, meta], index) => (
                        <View
                          key={label}
                          className="flex-row items-center gap-3 rounded-2xl bg-[#F3F6F1] p-3.5"
                        >
                          <View className="h-8 w-8 items-center justify-center rounded-full bg-white">
                            <Text className="text-sm font-black text-positive">{index + 1}</Text>
                          </View>
                          <Text className="min-w-0 flex-1 text-sm font-bold text-ink">{label}</Text>
                          <Text className="text-xs font-semibold text-[#728179]">{meta}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              </View>
            </View>

            <View className="gap-4 border-t border-[#385247] pt-8 sm:flex-row">
              {featureItems.map((item) => {
                const Icon = item.icon;
                return (
                  <View key={item.title} className="flex-1 gap-3 rounded-[24px] bg-[#1B332A] p-5">
                    <Icon color="#D9FB67" size={22} />
                    <Text className="text-base font-bold text-white">{item.title}</Text>
                    <Text className="text-sm leading-5 text-[#AFC0B6]">{item.description}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
