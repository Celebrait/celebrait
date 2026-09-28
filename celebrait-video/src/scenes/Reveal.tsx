import {
  AbsoluteFill,
  CanvasImage,
  Interactive,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
export const Reveal = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: "#EDECFA", color: "#211D19" }}>
      <Interactive.Div
        name="Reveal headline"
        style={{
          position: "absolute",
          top: 150,
          left: 90,
          right: 90,
          fontFamily: "Fraunces",
          fontWeight: 650,
          fontSize: 108,
          lineHeight: 1.04,
          letterSpacing: -3,
        }}
      >
        We make them
        <br />
        <span style={{ color: "#5c57d4" }}>the artwork.</span>
      </Interactive.Div>
      <Interactive.Div
        name="Photo becomes card"
        style={{
          position: "absolute",
          left: 90,
          top: 530,
          width: 900,
          height: 900,
          boxShadow: "0 35px 80px #342b6033",
        }}
      >
        <CanvasImage
          src={staticFile("proof-source-photo.webp")}
          style={{
            position: "absolute",
            width: 900,
            height: 900,
            objectFit: "cover",
          }}
        />
        <CanvasImage
          src={staticFile("proof-card-front.webp")}
          style={{
            position: "absolute",
            width: 900,
            height: 900,
            clipPath: `inset(0 ${interpolate(frame, [12, 65], [100, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}% 0 0)`,
          }}
        />
      </Interactive.Div>
      <Interactive.Div
        name="Reveal caption"
        style={{
          position: "absolute",
          top: 1550,
          left: 110,
          right: 110,
          fontSize: 49,
          lineHeight: 1.3,
          textAlign: "center",
          opacity: interpolate(frame, [65, 85], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        Their face. Your idea.
        <br />A birthday card only you could send.
      </Interactive.Div>
    </AbsoluteFill>
  );
};
