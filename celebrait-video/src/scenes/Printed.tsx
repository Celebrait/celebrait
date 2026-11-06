import {
  AbsoluteFill,
  CanvasImage,
  Interactive,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
export const Printed = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: "#FAF8F4", color: "#211D19" }}>
      <Interactive.Div
        name="Printed headline"
        style={{
          position: "absolute",
          top: 150,
          left: 90,
          right: 90,
          fontFamily: "Fraunces",
          fontWeight: 650,
          fontSize: 106,
          lineHeight: 1.05,
          letterSpacing: -3,
        }}
      >
        Made personal.
        <br />
        Made to keep.
      </Interactive.Div>
      <CanvasImage
        name="Printed card in hands"
        src={staticFile("keeper-card-open.webp")}
        style={{
          position: "absolute",
          top: 540,
          left: 0,
          width: 1080,
          height: 850,
          objectFit: "cover",
          opacity: interpolate(frame, [0, 20], [0, 1], {
            extrapolateRight: "clamp",
          }),
        }}
      />
      <Interactive.Div
        name="Print details"
        style={{
          position: "absolute",
          top: 1490,
          left: 90,
          right: 90,
          fontSize: 50,
          lineHeight: 1.4,
          textAlign: "center",
        }}
      >
        Your message inside.
        <br />
        Printed on 280gsm card.
        <br />
        Posted in the UK.
      </Interactive.Div>
    </AbsoluteFill>
  );
};
