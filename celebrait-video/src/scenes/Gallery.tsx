import {
  AbsoluteFill,
  CanvasImage,
  Interactive,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
export const Gallery = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: "#FAF8F4", color: "#211D19" }}>
      <Interactive.Div
        name="Gallery headline"
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
        Big adventures.
        <br />
        Very them.
      </Interactive.Div>
      <CanvasImage
        name="Big Ben card"
        src={staticFile("proof-bigben-front.webp")}
        style={{
          position: "absolute",
          left: 100,
          top: 500,
          width: 700,
          height: 700,
          rotate: "-7deg",
          boxShadow: "0 25px 65px #211d1925",
          translate: interpolate(frame, [0, 25], ["-180px 0px", "0px 0px"], {
            extrapolateRight: "clamp",
          }),
        }}
      />
      <CanvasImage
        name="Times Square card"
        src={staticFile("proof-timessquare-front.webp")}
        style={{
          position: "absolute",
          right: 85,
          top: 900,
          width: 700,
          height: 700,
          rotate: "6deg",
          boxShadow: "0 25px 65px #211d1930",
          opacity: interpolate(frame, [25, 45], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          translate: interpolate(frame, [25, 55], ["180px 50px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      />
      <Interactive.Div
        name="Gallery caption"
        style={{
          position: "absolute",
          top: 1690,
          left: 90,
          right: 90,
          textAlign: "center",
          fontSize: 46,
          color: "#5c57d4",
        }}
      >
        Dream up their scene.
      </Interactive.Div>
    </AbsoluteFill>
  );
};
