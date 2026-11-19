import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Image, type ImageSourcePropType, View } from "react-native";
import payment from "../../../assets/welcome/sale-payment.jpg";
import product from "../../../assets/welcome/sale-product.jpg";
import receipt from "../../../assets/welcome/sale-receipt.jpg";
import buy from "../../../assets/welcome/tour-buy.jpg";
import coco from "../../../assets/welcome/tour-coco.jpg";
import credit from "../../../assets/welcome/tour-credit.jpg";
import money from "../../../assets/welcome/tour-money.jpg";
import sell from "../../../assets/welcome/tour-sell.jpg";
import team from "../../../assets/welcome/tour-team.jpg";
import today from "../../../assets/welcome/tour-today.jpg";
import { TourLayout } from "./how-it-works";
import { type ChapterId, firstChapter, type TourId } from "./tours";

/** One frame of each chapter, bundled: native builds show the films as stills. */
const stills = {
  today,
  sell,
  credit,
  buy,
  money,
  coco,
  team,
  product,
  payment,
  receipt,
} satisfies Record<ChapterId, ImageSourcePropType>;

export function TourFilm() {
  const { t } = useTranslation();
  const [tour, setTour] = useState<TourId>("app");
  const [chapter, setChapter] = useState<ChapterId>(firstChapter("app"));
  return (
    <TourLayout
      chapter={chapter}
      media={
        <View className="aspect-video overflow-hidden bg-muted">
          <Image
            accessibilityLabel={t(`welcome.how.detail.${chapter}`)}
            resizeMode="contain"
            source={stills[chapter]}
            style={{ width: "100%", height: "100%" }}
          />
        </View>
      }
      onChapter={setChapter}
      onTour={(next) => {
        setTour(next);
        setChapter(firstChapter(next));
      }}
      tour={tour}
    />
  );
}
