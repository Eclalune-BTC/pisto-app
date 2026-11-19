import { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Composition,
  continueRender,
  delayRender,
  Easing,
  Img,
  interpolate,
  OffthreadVideo,
  registerRoot,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";

const fps = 24;
const chapters = [
  {
    start: 0,
    end: 132,
    title: "Consultar el precio",
    label: "Precio por bolsa",
    amount: "$3.25",
    description: "Coco encuentra el café molido en el catálogo de la tienda.",
  },
  {
    start: 132,
    end: 300,
    title: "Cotizar tres bolsas",
    label: "Tres bolsas de café",
    amount: "$9.75",
    description: "Puede preguntar «¿y tres?» sin volver a escribir el nombre del café.",
  },
  {
    start: 300,
    end: 456,
    title: "Revisar la venta",
    label: "Cantidad en el borrador",
    amount: "3 bolsas",
    description:
      "La cantidad y el total pasan a la venta. Usted revisa los datos antes de guardarla.",
  },
] as const;
const clamped = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
  easing: Easing.out(Easing.cubic),
} as const;
const forest = "#1b3d2c";
const lime = "#d9f86c";

function Footage({ chapter }: { chapter: number }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 11], [0, 1], clamped);
  const y = interpolate(frame, [0, 18], [14, 0], clamped);
  const shots = [
    { first: "home.png", second: "price.png", cut: 49 },
    { first: "quote.png", second: "quote.png", cut: 73 },
    { first: "prepared.png", second: "review.png", cut: 51 },
  ] as const;
  const shot = shots[chapter];
  if (!shot) throw new Error("Unknown demo chapter");
  const image = frame < shot.cut ? shot.first : shot.second;
  return (
    <div
      style={{
        position: "absolute",
        inset: "24px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity,
        transform: `translateY(${y}px)`,
      }}
    >
      {chapter === 2 && frame >= 90 ? (
        <div
          style={{
            display: "grid",
            gap: 18,
            width: "92%",
            opacity: interpolate(frame, [90, 100], [0, 1], clamped),
          }}
        >
          <Img src={staticFile("line.png")} style={{ width: "100%", display: "block" }} />
          <Img src={staticFile("total.png")} style={{ width: "100%", display: "block" }} />
        </div>
      ) : chapter === 1 && frame < 73 ? (
        <OffthreadVideo
          muted
          src={staticFile("followup.mp4")}
          style={{ width: "100%", maxHeight: "100%", objectFit: "contain" }}
        />
      ) : (
        <Img
          src={staticFile(image)}
          style={{ width: "100%", maxHeight: "100%", objectFit: "contain" }}
        />
      )}
    </div>
  );
}

function Demo() {
  const frame = useCurrentFrame();
  const [font] = useState(() => delayRender("Load the Pisto typeface"));
  useEffect(() => {
    const face = new FontFace("Pisto Hanken", `url("${staticFile("hanken-semibold.ttf")}")`);
    void face.load().then((loaded) => {
      document.fonts.add(loaded);
      continueRender(font);
    });
  }, [font]);
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#faf9f4",
        color: forest,
        fontFamily: "Pisto Hanken, sans-serif",
        fontWeight: 600,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 48,
          top: 42,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Img src={staticFile("mark.svg")} style={{ width: 45, height: 45 }} />
        <div style={{ fontSize: 48, letterSpacing: "-2.8px", lineHeight: 1 }}>pisto</div>
      </div>
      <div
        style={{
          position: "absolute",
          right: 46,
          top: 46,
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontSize: 22,
        }}
      >
        <Img src={staticFile("coco.png")} style={{ width: 39, height: 39, objectFit: "contain" }} />{" "}
        Coco
      </div>
      {chapters.map((item, idx) => (
        <Sequence key={item.start} from={item.start} durationInFrames={item.end - item.start}>
          <div
            style={{
              position: "absolute",
              left: 48,
              top: 158,
              width: 330,
              opacity: interpolate(frame - item.start, [0, 10], [0, 1], clamped),
            }}
          >
            <h1
              style={{
                fontSize: 62,
                letterSpacing: "-3.4px",
                lineHeight: 0.99,
                margin: "0 0 30px",
                fontWeight: 600,
              }}
            >
              {item.title}
            </h1>
            <p
              style={{
                fontSize: 26,
                letterSpacing: "-0.65px",
                lineHeight: 1.24,
                margin: 0,
                color: "#415045",
              }}
            >
              {item.description}
            </p>
          </div>
          <div
            style={{ position: "absolute", left: 49, bottom: 118, fontSize: 19, color: "#4b584d" }}
          >
            {item.label}
          </div>
          <div
            style={{
              position: "absolute",
              left: 46,
              bottom: 44,
              fontSize: 68,
              lineHeight: 1.1,
              letterSpacing: "-3.4px",
            }}
          >
            {item.amount}
          </div>
          <div
            style={{
              position: "absolute",
              left: 397,
              right: 40,
              top: 126,
              bottom: 53,
              background: forest,
              overflow: "hidden",
            }}
          >
            <Footage chapter={idx} />
          </div>
        </Sequence>
      ))}
      <div
        style={{
          position: "absolute",
          left: 397,
          right: 40,
          bottom: 36,
          height: 3,
          backgroundColor: "#d6dacc",
          display: "flex",
          gap: 4,
        }}
      >
        {chapters.map((item) => (
          <div key={item.start} style={{ flex: item.end - item.start, backgroundColor: "#c2c9ba" }}>
            <div
              style={{
                height: "100%",
                width: `${interpolate(frame, [item.start, item.end - 1], [0, 100], clamped)}%`,
                backgroundColor: frame >= item.end ? forest : "#669332",
              }}
            />
          </div>
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          right: 40,
          top: 112,
          height: 6,
          width: 60,
          backgroundColor: lime,
        }}
      />
    </AbsoluteFill>
  );
}

function Root() {
  return (
    <Composition
      id="Coco"
      component={Demo}
      width={1280}
      height={720}
      fps={fps}
      durationInFrames={chapters[2].end}
    />
  );
}
registerRoot(Root);
