import type { ComponentProps, PropsWithChildren } from "react";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";

import { cn } from "@/lib/cn";

type PageWidth = "content" | "form" | "reading";

const widthClasses: Record<PageWidth, string> = {
  content: "max-w-[1180px]",
  form: "max-w-[900px]",
  reading: "max-w-[760px]",
};

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
  keyboardDismissMode = "on-drag",
  keyboardShouldPersistTaps = "handled",
  showsVerticalScrollIndicator = false,
  width = "content",
  ...props
}: PageProps) {
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
          "w-full gap-8 px-5 pb-12 pt-7 sm:px-8 sm:pt-10 lg:px-10 xl:px-12",
          widthClasses[width],
          contentContainerClassName,
        )}
        keyboardDismissMode={keyboardDismissMode}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
