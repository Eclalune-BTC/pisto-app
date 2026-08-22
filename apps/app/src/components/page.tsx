import type { ComponentProps, PropsWithChildren } from "react";
import { ScrollView } from "react-native";

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
  showsVerticalScrollIndicator = false,
  width = "content",
  ...props
}: PageProps) {
  return (
    <ScrollView
      {...props}
      className={cn("flex-1", className)}
      contentContainerClassName={cn(
        "w-full gap-8 px-5 pb-12 pt-7 sm:px-8 sm:pt-10 lg:px-10 xl:px-12",
        widthClasses[width],
        contentContainerClassName,
      )}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
    >
      {children}
    </ScrollView>
  );
}
