import "./index.css";
import "./assets";
import { Composition } from "remotion";
import { Showcase } from "./Composition";
export const RemotionRoot = () => (
  <Composition
    id="CelebraitShowcase"
    component={Showcase}
    durationInFrames={750}
    fps={30}
    width={1080}
    height={1920}
  />
);
