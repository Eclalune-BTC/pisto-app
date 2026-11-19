import { Play } from "lucide-react-native";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { FILM_STARTS, type FilmChapter, FilmLayout } from "./how-it-works";

export function SaleFilm() {
  const { t } = useTranslation();
  const video = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState<FilmChapter>("product");
  const pendingTime = useRef<number | null>(null);
  function playChapter(step: FilmChapter) {
    const player = video.current;
    if (!player) return;
    setFailed(false);
    setActive(step);
    const time = FILM_STARTS[step];
    if (player.readyState >= 1 && !player.error) {
      player.currentTime = time;
    } else {
      pendingTime.current = time;
      if (player.error) player.load();
    }
    void player.play().catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setFailed(true);
      setStarted(false);
    });
  }
  return (
    <FilmLayout
      active={active}
      onSelect={playChapter}
      media={
        <View className="min-w-0 gap-2">
          <View className="relative aspect-video overflow-hidden bg-brand">
            <video
              aria-label={t("welcome.how.filmLabel")}
              controls={started}
              playsInline
              preload="none"
              muted
              poster="/media/venta-de-cafe.jpg"
              ref={video}
              onLoadedMetadata={() => {
                if (video.current && pendingTime.current !== null) {
                  video.current.currentTime = pendingTime.current;
                  pendingTime.current = null;
                }
              }}
              onPlay={() => {
                setStarted(true);
                setFailed(false);
              }}
              onError={() => {
                setFailed(true);
                setStarted(false);
              }}
              onTimeUpdate={() => {
                const time = video.current?.currentTime ?? 0;
                setActive(
                  time >= FILM_STARTS.receipt
                    ? "receipt"
                    : time >= FILM_STARTS.payment
                      ? "payment"
                      : "product",
                );
              }}
              style={{ display: "block", width: "100%", height: "100%", objectFit: "contain" }}
            >
              <source src="/media/venta-de-cafe.mp4" type="video/mp4" />
              <track
                kind="captions"
                src="/media/venta-de-cafe.vtt"
                srcLang="es"
                label={t("welcome.how.filmCaptions")}
              />
            </video>
            {!started ? (
              <View className="absolute bottom-3 left-3 sm:bottom-5 sm:left-5">
                <Button
                  accessibilityLabel={t("welcome.how.play")}
                  onPress={() => playChapter("product")}
                  className="min-h-10 gap-2 bg-highlight px-4 web:hover:bg-highlight-strong"
                >
                  <Icon as={Play} size={16} className="text-highlight-foreground" />
                  <Text className="font-ui text-dense text-highlight-foreground">
                    {t("welcome.how.playShort")} · {t("welcome.how.duration")}
                  </Text>
                </Button>
              </View>
            ) : null}
          </View>
          {failed ? (
            <Text accessibilityLiveRegion="polite" className="text-sm text-destructive">
              {t("welcome.how.filmError")}
            </Text>
          ) : null}
          <Text asChild className="self-start py-2 font-ui text-sm text-foreground underline">
            <a href="/media/coco-demo.mp4">{t("welcome.how.cocoDemo")}</a>
          </Text>
        </View>
      }
    />
  );
}
