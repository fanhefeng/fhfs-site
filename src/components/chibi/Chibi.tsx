import { ChibiArt } from "./ChibiArt";
import { ChibiStage } from "./ChibiStage";

/**
 * fhf as a chibi you can poke: the drawing rendered here, on the server, and
 * handed to the client stage that makes it look, blink and react.
 */
export function Chibi({ label, hint }: { label: string; hint: string }) {
  return (
    <ChibiStage label={label} hint={hint}>
      <ChibiArt />
    </ChibiStage>
  );
}
