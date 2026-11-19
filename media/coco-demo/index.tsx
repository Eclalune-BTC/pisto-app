import { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Composition,
  continueRender,
  delayRender,
  Easing,
  Img,
  interpolate,
  registerRoot,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";

const fps = 30;
const forest = "#1b3d2c";
const lime = "#d9f86c";
const ink = "#131312";
const muted = "#62625e";
const paper = "#f4f4f1";
const hairline = "#dcdcd8";

/** Where the app is shown. Desktop footage is 1280 by 800 CSS pixels, the same proportion. */
const stage = { left: 452, top: 90, width: 1408, height: 880 };
const footageWidth = 1280;

const seconds = (value: number) => Math.round(value * fps);
const eased = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
  easing: Easing.inOut(Easing.cubic),
} as const;
const settled = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
  easing: Easing.out(Easing.cubic),
} as const;

/** The part of the footage on screen: its left and top edge and its width, in CSS pixels. */
type View = readonly [x: number, y: number, width: number];
const whole: View = [0, 0, footageWidth];

type Shot = {
  /** Footage files shown one after another for an equal share of the shot, as when typing. */
  frames: readonly string[];
  seconds: number;
  from?: View;
  to?: View;
  /** Cuts in without the dissolve, for consecutive frames of one action. */
  cut?: boolean;
};

type Chapter = {
  title: string;
  line: string;
  shots: readonly Shot[];
};

const still = (file: string, time: number, from: View = whole, to: View = from): Shot => ({
  frames: [file],
  seconds: time,
  from,
  to,
});

const intro = seconds(3);
const outro = seconds(3);

const content: View = [228, 30, 1052];
const dialog: View = [286, 170, 708];
/** A page from its title to its right edge, slightly closer than `content`. */
const module: View = [240, 48, 1012];

const chapters: readonly Chapter[] = [
  {
    title: "El día de la tienda",
    line: "Al abrir Pisto ve el dinero disponible, lo que se movió hoy y lo que falta cobrar y pagar.",
    shots: [
      still("home", 2.6, whole, content),
      still("home-tall", 2.4, content, [262, 250, 990]),
      still("home-tall", 2, [262, 250, 990], [262, 560, 990]),
    ],
  },
  {
    title: "Vender",
    line: "Cada venta queda con sus productos, cómo se pagó y su comprobante. El inventario baja solo.",
    shots: [
      still("module-sales", 3, content, module),
      still("sale-detail", 3, content, module),
      still("sale-review", 3, content, [250, 110, 560]),
    ],
  },
  {
    title: "Fiado y cobros",
    line: "Sabe quién le debe, desde cuándo y cuánto está vencido. Cada abono baja el saldo del cliente.",
    shots: [
      still("module-receivables", 3.5, content, module),
      still("module-receivables", 3.5, module, [240, 168, 1012]),
    ],
  },
  {
    title: "Compras e inventario",
    line: "Las facturas de sus proveedores, lo que vence primero y las existencias que se están acabando.",
    shots: [
      still("module-payables", 3.2, content, module),
      still("module-inventory", 3, content, module),
      still("module-catalog", 2.8, content, module),
    ],
  },
  {
    title: "Caja, gastos y reportes",
    line: "El efectivo y el banco por cuenta, los gastos por categoría y el resumen del período.",
    shots: [
      still("module-cash", 3.2, content, module),
      still("module-expenses", 3.2, content, module),
      still("module-reports-tall", 5.6, content, [262, 420, 990]),
    ],
  },
  {
    title: "Coco, su asistente",
    line: "Dicte una venta o pregunte cuánto vendió. Coco prepara el borrador y responde con sus registros.",
    shots: [
      {
        frames: ["dictate-1", "dictate-2", "dictate-3", "dictate-4", "dictate-5"],
        seconds: 3.2,
        from: [236, 120, 840],
        to: dialog,
      },
      { ...still("dictate-transcribing", 0.6, dialog), cut: true },
      still("dictate-heard", 2, [200, 160, 880]),
      still("sale-review-due-tall", 2.2, [640, 130, 640], [640, 700, 640]),
      {
        frames: ["ask-type-1", "ask-type-2", "ask-type-3", "ask-type-4"],
        seconds: 1.6,
        from: [262, 100, 990],
        to: [400, 110, 860],
      },
      { ...still("ask-reading", 0.6, [400, 110, 860]), cut: true },
      still("ask-answer-1", 3, [256, 150, 768], [330, 160, 620]),
      {
        frames: ["ask-follow-1", "ask-follow-2", "ask-follow-3", "ask-follow-4"],
        seconds: 1.4,
        from: [330, 180, 620],
        cut: true,
      },
      { ...still("ask-reading-2", 0.6, [330, 180, 620]), cut: true },
      still("ask-answer-2", 3.8, [320, 40, 640], [320, 238, 640]),
    ],
  },
  {
    title: "Equipo y teléfono",
    line: "Un rol para cada persona de la tienda, y todo Pisto también en el teléfono.",
    shots: [still("module-settings-tall", 3, [690, 180, 590], [690, 360, 590])],
  },
];

const phones = ["phone-home", "phone-answer", "phone-movements"] as const;
const phoneSeconds = 3;

const chapterFrames = chapters.map((chapter, index) => {
  const shots = chapter.shots.reduce((total, shot) => total + seconds(shot.seconds), 0);
  return (
    shots +
    (index === 0 ? intro : 0) +
    (index === chapters.length - 1 ? seconds(phoneSeconds) + outro : 0)
  );
});
const chapterStarts = chapterFrames.map((_, index) =>
  chapterFrames.slice(0, index).reduce((total, frames) => total + frames, 0),
);
const totalFrames = chapterFrames.reduce((total, frames) => total + frames, 0);

function Footage({ shot, duration }: { shot: Shot; duration: number }) {
  const frame = useCurrentFrame();
  const from = shot.from ?? whole;
  const to = shot.to ?? from;
  const progress = interpolate(frame, [0, duration - 1], [0, 1], eased);
  const x = from[0] + (to[0] - from[0]) * progress;
  const y = from[1] + (to[1] - from[1]) * progress;
  const width = from[2] + (to[2] - from[2]) * progress;
  const scale = stage.width / width;
  const index = Math.min(
    shot.frames.length - 1,
    Math.floor((frame / duration) * shot.frames.length),
  );
  return (
    <AbsoluteFill style={{ opacity: shot.cut ? 1 : interpolate(frame, [0, 9], [0, 1], settled) }}>
      {shot.frames.map((file, position) => (
        <Img
          key={file}
          src={staticFile(`tour/${file}.webp`)}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: footageWidth,
            transformOrigin: "0 0",
            transform: `scale(${scale}) translate(${-x}px, ${-y}px)`,
            opacity: position === index ? 1 : 0,
          }}
        />
      ))}
    </AbsoluteFill>
  );
}

function Phones() {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        backgroundColor: paper,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 44,
        opacity: interpolate(frame, [0, 9], [0, 1], settled),
      }}
    >
      {phones.map((file, index) => (
        <div
          key={file}
          style={{
            width: 372,
            height: 806,
            borderRadius: 44,
            border: `9px solid ${ink}`,
            overflow: "hidden",
            backgroundColor: "#fff",
            transform: `translateY(${interpolate(frame, [index * 4, index * 4 + 16], [36, 0], settled)}px)`,
            opacity: interpolate(frame, [index * 4, index * 4 + 12], [0, 1], settled),
          }}
        >
          <Img src={staticFile(`tour/${file}.webp`)} style={{ width: "100%", display: "block" }} />
        </div>
      ))}
    </AbsoluteFill>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: forest,
        color: "#fff",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "0 150px",
      }}
    >
      {children}
    </AbsoluteFill>
  );
}

function Brand({ size, color }: { size: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.28 }}>
      <Img src={staticFile("mark.svg")} style={{ width: size, height: size }} />
      <div
        style={{
          fontSize: size * 1.08,
          fontWeight: 600,
          letterSpacing: "-0.055em",
          lineHeight: 1,
          color,
        }}
      >
        pisto
      </div>
    </div>
  );
}

function Tour() {
  const frame = useCurrentFrame();
  const [fonts] = useState(() => delayRender("Load the Pisto typeface"));
  useEffect(() => {
    const faces = [
      new FontFace("Pisto Hanken", `url("${staticFile("hanken-semibold.ttf")}")`, {
        weight: "600",
      }),
      new FontFace("Pisto Hanken", `url("${staticFile("hanken-regular.ttf")}")`, { weight: "400" }),
    ];
    void Promise.all(faces.map((face) => face.load())).then((loaded) => {
      for (const face of loaded) document.fonts.add(face);
      continueRender(fonts);
    });
  }, [fonts]);
  const current = chapterStarts.findLastIndex((start) => frame >= start);

  return (
    <AbsoluteFill
      style={{ backgroundColor: paper, color: ink, fontFamily: "Pisto Hanken, sans-serif" }}
    >
      <div style={{ position: "absolute", left: 64, top: 58 }}>
        <Brand color={forest} size={50} />
      </div>
      <div
        style={{
          position: "absolute",
          left: stage.left,
          top: stage.top,
          width: stage.width,
          height: stage.height,
          overflow: "hidden",
          borderRadius: 14,
          border: `1px solid ${hairline}`,
          backgroundColor: "#fff",
        }}
      >
        {chapters.map((chapter, index) => {
          let offset = (chapterStarts[index] ?? 0) + (index === 0 ? intro : 0);
          return chapter.shots.map((shot) => {
            const duration = seconds(shot.seconds);
            const from = offset;
            offset += duration;
            return (
              <Sequence
                durationInFrames={duration + 10}
                from={from}
                key={`${shot.frames[0]}-${from}`}
                layout="none"
              >
                <Footage duration={duration} shot={shot} />
              </Sequence>
            );
          });
        })}
        <Sequence
          durationInFrames={seconds(phoneSeconds)}
          from={totalFrames - outro - seconds(phoneSeconds)}
          layout="none"
        >
          <Phones />
        </Sequence>
      </div>
      {chapters.map((chapter, index) => {
        const start = (chapterStarts[index] ?? 0) + (index === 0 ? intro : 0);
        const local = frame - start;
        if (index !== current) return null;
        return (
          <div
            key={chapter.title}
            style={{
              position: "absolute",
              left: 64,
              top: 236,
              width: 336,
              opacity: interpolate(local, [0, 10], [0, 1], settled),
              transform: `translateY(${interpolate(local, [0, 14], [14, 0], settled)}px)`,
            }}
          >
            <div style={{ fontSize: 26, fontWeight: 600, color: muted, marginBottom: 18 }}>
              0{index + 1} / 0{chapters.length}
            </div>
            <div
              style={{ fontSize: 62, fontWeight: 600, lineHeight: 1.02, letterSpacing: "-0.045em" }}
            >
              {chapter.title}
            </div>
            <div
              style={{
                marginTop: 30,
                fontSize: 30,
                fontWeight: 400,
                lineHeight: 1.3,
                letterSpacing: "-0.01em",
                color: "#3c3c39",
              }}
            >
              {chapter.line}
            </div>
          </div>
        );
      })}
      <div
        style={{ position: "absolute", left: 64, bottom: 62, width: 336, display: "flex", gap: 6 }}
      >
        {chapters.map((chapter, index) => {
          const start = chapterStarts[index] ?? 0;
          const end = start + (chapterFrames[index] ?? 0);
          return (
            <div
              key={chapter.title}
              style={{
                flex: 1,
                height: 6,
                backgroundColor: hairline,
                borderRadius: 3,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${interpolate(frame, [start, end - 1], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}%`,
                  backgroundColor: forest,
                }}
              />
            </div>
          );
        })}
      </div>
      <Sequence durationInFrames={intro} layout="none">
        <Card>
          <div
            style={{
              opacity: interpolate(frame, [intro - 10, intro - 1], [1, 0], settled),
              transform: `translateY(${interpolate(frame, [0, 16], [18, 0], settled)}px)`,
            }}
          >
            <Brand color="#fff" size={104} />
            <div
              style={{
                marginTop: 54,
                fontSize: 92,
                fontWeight: 600,
                lineHeight: 1.02,
                letterSpacing: "-0.045em",
              }}
            >
              Toda su tienda
              <br />
              en un solo lugar.
            </div>
            <div style={{ marginTop: 34, display: "flex", alignItems: "center", gap: 18 }}>
              <div style={{ width: 64, height: 8, backgroundColor: lime }} />
              <div style={{ fontSize: 34, fontWeight: 400, color: "rgba(255,255,255,0.86)" }}>
                Ventas, fiado, compras, inventario, caja y reportes
              </div>
            </div>
          </div>
        </Card>
      </Sequence>
      <Sequence durationInFrames={outro} from={totalFrames - outro} layout="none">
        <Card>
          <div
            style={{
              opacity: interpolate(frame - (totalFrames - outro), [0, 10], [0, 1], settled),
            }}
          >
            <Brand color="#fff" size={104} />
            <div
              style={{
                marginTop: 54,
                fontSize: 104,
                fontWeight: 600,
                lineHeight: 1,
                letterSpacing: "-0.045em",
              }}
            >
              Empiece hoy
              <br />
              con su tienda.
            </div>
            <div style={{ marginTop: 40, display: "flex", alignItems: "center", gap: 18 }}>
              <div style={{ width: 64, height: 8, backgroundColor: lime }} />
              <div style={{ fontSize: 34, fontWeight: 400, color: "rgba(255,255,255,0.86)" }}>
                Cree su cuenta y registre su primera venta
              </div>
            </div>
          </div>
        </Card>
      </Sequence>
    </AbsoluteFill>
  );
}

function Root() {
  return (
    <Composition
      component={Tour}
      durationInFrames={totalFrames}
      fps={fps}
      height={1080}
      id="Tour"
      width={1920}
    />
  );
}
registerRoot(Root);
