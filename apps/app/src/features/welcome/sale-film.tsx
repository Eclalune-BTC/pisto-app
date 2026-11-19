import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Image, View } from "react-native";
import payment from "../../../assets/welcome/sale-payment.jpg";
import product from "../../../assets/welcome/sale-product.jpg";
import receipt from "../../../assets/welcome/sale-receipt.jpg";
import { type FilmChapter, FilmLayout } from "./how-it-works";

const stills = { product, payment, receipt };
export function SaleFilm() {
  const { t } = useTranslation();
  const [active, setActive] = useState<FilmChapter>("product");
  return (
    <FilmLayout
      active={active}
      onSelect={setActive}
      media={
        <View className="aspect-video overflow-hidden bg-muted">
          <Image
            accessibilityLabel={t(`welcome.how.detail.${active}`)}
            resizeMode="contain"
            source={stills[active]}
            style={{ width: "100%", height: "100%" }}
          />
        </View>
      }
    />
  );
}
