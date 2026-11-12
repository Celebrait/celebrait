import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { Photo } from "./scenes/Photo";
import { Reveal } from "./scenes/Reveal";
import { Gallery } from "./scenes/Gallery";
import { Printed } from "./scenes/Printed";
import { Close } from "./scenes/Close";
export const Showcase = () => (
  <TransitionSeries>
    <TransitionSeries.Sequence durationInFrames={150}>
      <Photo />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition
      presentation={fade()}
      timing={linearTiming({ durationInFrames: 15 })}
    />
    <TransitionSeries.Sequence durationInFrames={180}>
      <Reveal />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition
      presentation={fade()}
      timing={linearTiming({ durationInFrames: 15 })}
    />
    <TransitionSeries.Sequence durationInFrames={150}>
      <Gallery />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition
      presentation={fade()}
      timing={linearTiming({ durationInFrames: 15 })}
    />
    <TransitionSeries.Sequence durationInFrames={150}>
      <Printed />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition
      presentation={fade()}
      timing={linearTiming({ durationInFrames: 15 })}
    />
    <TransitionSeries.Sequence durationInFrames={180}>
      <Close />
    </TransitionSeries.Sequence>
  </TransitionSeries>
);
