import {
  AbsoluteFill,
  Interactive,
  interpolate,
  useCurrentFrame,
} from "remotion";
export const Close = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#EDECFA",
        color: "#211D19",
        alignItems: "center",
        justifyContent: "center",
        padding: 90,
        textAlign: "center",
      }}
    >
      <Interactive.Div
        name="Brand lockup"
        style={{
          fontFamily: "Fraunces",
          fontWeight: 650,
          fontSize: 92,
          color: "#5c57d4",
          marginBottom: 90,
        }}
      >
        celebrait
      </Interactive.Div>
      <Interactive.Div
        name="Closing headline"
        style={{
          fontFamily: "Fraunces",
          fontWeight: 650,
          fontSize: 118,
          lineHeight: 1.02,
          letterSpacing: -4,
          opacity: interpolate(frame, [0, 20], [0, 1], {
            extrapolateRight: "clamp",
          }),
        }}
      >
        For someone
        <br />
        who’s anything
        <br />
        but ordinary.
      </Interactive.Div>
      <Interactive.Div
        name="Call to action"
        style={{
          marginTop: 100,
          backgroundColor: "#5c57d4",
          color: "white",
          padding: "30px 48px",
          borderRadius: 70,
          fontSize: 50,
        }}
      >
        Make their card
      </Interactive.Div>
      <Interactive.Div name="Website" style={{ fontSize: 47, marginTop: 55 }}>
        celebrait.co.uk
      </Interactive.Div>
      <Interactive.Div
        name="Delivery expectation"
        style={{
          position: "absolute",
          bottom: 130,
          left: 100,
          right: 100,
          fontSize: 36,
          lineHeight: 1.3,
          color: "#645C53",
        }}
      >
        Please allow at least a week
        <br />
        from order to arrival.
      </Interactive.Div>
    </AbsoluteFill>
  );
};
