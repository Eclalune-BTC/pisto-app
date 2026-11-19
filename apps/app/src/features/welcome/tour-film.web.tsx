import { Play } from "lucide-react-native";
import { type Ref, useImperativeHandle, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { TourLayout } from "./how-it-works";
import { type ChapterId, chapterAt, chapterStart, firstChapter, TOURS, type TourId } from "./tours";

type PlayerHandle = { play: (seconds: number) => void };

function Player({
  tour,
  onChapter,
  ref,
}: {
  tour: TourId;
  onChapter: (chapter: ChapterId) => void;
  /** Lets the chapter list seek this film. */
  ref: Ref<PlayerHandle>;
}) {
  const { t } = useTranslation();
  const video = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState(false);
  const pendingTime = useRef<number | null>(null);
  const film = TOURS[tour];

  function play(seconds: number, focus = false) {
    const player = video.current;
    if (!player) return;
    setFailed(false);
    if (player.readyState >= 1 && !player.error) {
      player.currentTime = seconds;
    } else {
      pendingTime.current = seconds;
      if (player.error) player.load();
    }
    // The play button leaves the page once the film starts, so the keyboard continues on the film.
    if (focus) player.focus({ preventScroll: true });
    void player.play().catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setFailed(true);
      setStarted(false);
    });
  }
  useImperativeHandle(ref, () => ({ play }));

  return (
    <View className="min-w-0 gap-2">
      <View className="relative aspect-video overflow-hidden bg-brand">
        <video
          aria-label={t(`welcome.how.tours.${tour}.label`)}
          controls={started}
          muted
          onError={() => {
            setFailed(true);
            setStarted(false);
          }}
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
          onTimeUpdate={() => onChapter(chapterAt(tour, video.current?.currentTime ?? 0))}
          playsInline
          poster={film.poster}
          preload="none"
          ref={video}
          style={{ display: "block", width: "100%", height: "100%", objectFit: "contain" }}
          tabIndex={started ? 0 : -1}
        >
          <source src={film.video} type="video/mp4" />
          <track
            kind="captions"
            label={t("welcome.how.filmCaptions")}
            src={film.captions}
            srcLang="es"
          />
        </video>
        {!started ? (
          <View className="absolute bottom-3 left-3 sm:bottom-5 sm:left-5">
            <Button
              accessibilityLabel={t(`welcome.how.tours.${tour}.play`)}
              className="min-h-10 gap-2 bg-highlight px-4 web:hover:bg-highlight-strong"
              onPress={() => play(0, true)}
            >
              <Icon as={Play} className="text-highlight-foreground" size={16} />
              <Text className="font-ui text-dense text-highlight-foreground">
                {t("welcome.how.playShort")} · {film.duration}
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
    </View>
  );
}

export function TourFilm() {
  const [tour, setTour] = useState<TourId>("app");
  const [chapter, setChapter] = useState<ChapterId>(firstChapter("app"));
  const player = useRef<PlayerHandle>(null);
  return (
    <TourLayout
      chapter={chapter}
      media={
        // Each film is its own element: choosing the other one stops this one and starts clean.
        <Player key={tour} onChapter={setChapter} ref={player} tour={tour} />
      }
      onChapter={(next) => {
        setChapter(next);
        player.current?.play(chapterStart(tour, next));
      }}
      onTour={(next) => {
        setTour(next);
        setChapter(firstChapter(next));
      }}
      tour={tour}
    />
  );
}
