import type { ComponentType, PropsWithChildren } from "react";
import { Pressable, View } from "react-native";

// Composition tests do not execute native animation or claim timing/device coverage.
const transition = {
  duration: (_value: number) => transition,
  delay: (_value: number) => transition,
  reduceMotion: (_value: unknown) => transition,
  withInitialValues: (_value: unknown) => transition,
};
export const FadeIn = transition;
export const FadeOut = transition;
export const FadeOutUp = transition;
export const FadeInUp = transition;
export const FadeInDown = transition;
export const LinearTransition = transition;
export const ReduceMotion = { System: "system" };
export const useDerivedValue = <T,>(factory: () => T) => ({ value: factory() });
export const useAnimatedStyle = <T,>(factory: () => T) => factory();
export const withTiming = <T,>(value: T) => value;
export function LayoutAnimationConfig({ children }: PropsWithChildren) {
  return children;
}
export default {
  View,
  createAnimatedComponent: <T,>(component: ComponentType<T>) => component,
  Pressable,
};
