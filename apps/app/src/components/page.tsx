import type { ComponentProps, PropsWithChildren } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useShellTopInset } from "@/components/shell/shell-context";
import { cn } from "@/lib/cn";

type PageWidth = "content" | "form" | "reading";

const widthClasses: Record<PageWidth, string> = {
  content: "max-w-[1120px]",
  // A form sits on the content grid and narrows inside it, so its title starts where the title
  // of the list it came from did.
  form: "max-w-[1120px]",
  reading: "max-w-[720px]",
};

const PAGE_TOP_SPACING = 20;

type PageProps = PropsWithChildren<
  Omit<ComponentProps<typeof ScrollView>, "contentContainerClassName"> & {
    contentContainerClassName?: string;
    width?: PageWidth;
  }
>;

export function Page({
  children,
  className,
  contentContainerClassName,
  contentContainerStyle,
  keyboardDismissMode = "on-drag",
  keyboardShouldPersistTaps = "handled",
  showsVerticalScrollIndicator = Platform.OS === "web",
  width = "content",
  ...props
}: PageProps) {
  const topInset = useShellTopInset();
  return (
    // Android resizes the window for the keyboard on its own; adding a behavior
    // there would offset the content twice.
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1"
    >
      <ScrollView
        {...props}
        className={cn("flex-1", className)}
        contentContainerClassName={cn(
          "mx-auto w-full gap-6 px-4 pb-12 sm:px-6 lg:px-8",
          widthClasses[width],
          contentContainerClassName,
        )}
        contentContainerStyle={[{ paddingTop: topInset + PAGE_TOP_SPACING }, contentContainerStyle]}
        keyboardDismissMode={keyboardDismissMode}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        scrollIndicatorInsets={{ top: topInset }}
        showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      >
        {width === "form" ? (
          <View className="w-full max-w-[696px] gap-6">{children}</View>
        ) : (
          children
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
