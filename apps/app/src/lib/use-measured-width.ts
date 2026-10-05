import { useState } from "react";
import { type LayoutChangeEvent, useWindowDimensions } from "react-native";

/** The laid-out width of a container, seeded from the window until the first layout. */
export function useMeasuredWidth(): {
  onLayout: (event: LayoutChangeEvent) => void;
  width: number;
} {
  const window = useWindowDimensions();
  const [measured, setMeasured] = useState<number | null>(null);
  return {
    onLayout: (event) => setMeasured(event.nativeEvent.layout.width),
    width: measured ?? window.width,
  };
}
