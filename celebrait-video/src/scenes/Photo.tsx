import {
  AbsoluteFill,
  CanvasImage,
  Interactive,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
export const Photo = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{ backgroundColor: "#FAF8F4", color: "#211D19", padding: 90 }}
    >
      <Interactive.Div
        name="Brand"
        style={{
          fontFamily: "Fraunces",
          fontWeight: 650,
          fontSize: 48,
          color: "#5c57d4",
        }}
      >
        celebrait
      </Interactive.Div>
      <Interactive.Div
        name="Opening headline"
        style={{
          fontFamily: "Fraunces",
          fontWeight: 650,
          fontSize: 104,
          lineHeight: 1.05,
          marginTop: 100,
          letterSpacing: -3,
          opacity: interpolate(frame, [0, 20], [0, 1], {
            extrapolateRight: "clamp",
          }),
          translate: interpolate(frame, [0, 25], ["0px 35px", "0px 0px"], {
            extrapolateRight: "clamp",
          }),
        }}
      >
        Their photo.
        <br />A little possibility.
      </Interactive.Div>
      <Interactive.Div
        name="Photo print"
        style={{
          position: "absolute",
          left: 155,
          top: 610,
          width: 770,
          height: 830,
          padding: 24,
          backgroundColor: "white",
          boxShadow: "0 30px 65px #211d1920",
          rotate: "-4deg",
          opacity: interpolate(frame, [10, 30], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          translate: interpolate(frame, [10, 40], ["0px 100px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <CanvasImage
          src={staticFile("proof-source-photo.webp")}
          style={{ width: 722, height: 720, objectFit: "cover" }}
        />
        <Interactive.Div
          name="Photo caption"
          style={{ fontSize: 34, textAlign: "center", paddingTop: 22 }}
        >
          Start with someone you love.
        </Interactive.Div>
      </Interactive.Div>
      <Interactive.Div
        name="Scene prompt"
        style={{
          position: "absolute",
          left: 100,
          right: 100,
          top: 1540,
          fontSize: 46,
          lineHeight: 1.3,
          textAlign: "center",
          color: "#5c57d4",
          opacity: interpolate(frame, [50, 75], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        “Mum, under the Northern Lights.”
      </Interactive.Div>
    </AbsoluteFill>
  );
};
