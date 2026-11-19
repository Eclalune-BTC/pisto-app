import { Image, View } from "react-native";
import portrait from "../../../assets/assistant/coco.png";

export type CocoActivity = "idle" | "recording" | "transcribing" | "interpreting";

/** The adjacent name and task text carry the accessible meaning of the illustration. */
export function Coco({ size = 54, activity = "idle" }: { size?: number; activity?: CocoActivity }) {
  return (
    <View aria-hidden key={activity} className={activity === "idle" ? undefined : "pisto-coco-nod"}>
      <Image
        accessible={false}
        aria-hidden
        resizeMode="contain"
        source={portrait}
        style={{ width: size, height: size }}
      />
    </View>
  );
}
