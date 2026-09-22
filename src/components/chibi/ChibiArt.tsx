import { FACE, HAIR, HIGHLIGHT, JACKET, LENS_L, LENS_R, SHADE, SHIRT, TUFT } from "./art";

/*
 * The drawing, in the source image's own coordinates (1254 × 1254). Nothing
 * here moves by itself: every group the stage animates is a bare `<g
 * data-c>` with no transform of its own — GSAP writes the transform
 * attribute, and an authored one would be overwritten. Where a shape needs
 * placing (an eye, a cheek, the mouth), the placing group sits *outside*
 * the animated one.
 */

const INK = "#181414";
const FRAME = "#2c211b";
const LIP = "#7a2e2a";
const LINE = "#6b3a30";

/** Pupil centres and the head's tilt, measured off the traced pupils. */
const EYE_L = "translate(346 801) rotate(18)";
const EYE_R = "translate(664 906) rotate(19)";
const MOUTH = "translate(440 1036) rotate(18)";
const CHEEK_L = "translate(189 931) rotate(26)";
const CHEEK_R = "translate(689 1099) rotate(13)";

/** One eye in every state it can take; the stage shows one at a time. */
function Eye({ side }: { side: "l" | "r" }) {
  return (
    <g transform={side === "l" ? EYE_L : EYE_R}>
      <g data-c="lid">
        <rect data-eye="open" x="-31" y="-77" width="62" height="155" rx="31" fill={INK} />
        <path
          data-eye="happy"
          opacity="0"
          d="M-50 24Q0-62 50 24"
          fill="none"
          stroke={INK}
          strokeWidth="24"
          strokeLinecap="round"
        />
        <path
          data-eye="shut"
          opacity="0"
          d="M-48-6Q0 36 48-6"
          fill="none"
          stroke={INK}
          strokeWidth="20"
          strokeLinecap="round"
        />
        <g data-eye="round" opacity="0">
          <circle r="46" fill={INK} />
          <circle cx="-14" cy="-17" r="13" fill="#fff" />
          <circle cx="15" cy="16" r="6" fill="#fff" />
        </g>
        <path
          data-eye="spiral"
          opacity="0"
          d="M0 0A6 6 0 0 1 12 0A12 12 0 0 1-12 0A18 18 0 0 1 24 0A24 24 0 0 1-24 0A30 30 0 0 1 36 0A36 36 0 0 1-36 0A42 42 0 0 1 48 0"
          fill="none"
          stroke={INK}
          strokeWidth="10"
          strokeLinecap="round"
        />
        <g data-eye="heart" opacity="0">
          <path
            d="M0 42C-58 4-54-46-19-46C-6-46 0-36 0-27C0-36 6-46 19-46C54-46 58 4 0 42Z"
            fill="#e0485f"
          />
          <circle cx="-22" cy="-26" r="8" fill="#fff" opacity="0.8" />
        </g>
        <path
          data-eye="squeeze"
          opacity="0"
          d={side === "l" ? "M-30-38L28 0L-30 38" : "M30-38L-28 0L30 38"}
          fill="none"
          stroke={INK}
          strokeWidth="22"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </g>
  );
}

function Cheek({ place }: { place: string }) {
  return (
    <g transform={place}>
      <ellipse rx="47" ry="29" fill="#e4b08c" />
      {/* The anime blush lines, for when a pink patch is not enough. */}
      <path
        data-c="hatch"
        opacity="0"
        d="M-28 12L-16-12M-6 12L6-12M16 12L28-12"
        stroke="#d9826b"
        strokeWidth="6"
        strokeLinecap="round"
      />
    </g>
  );
}

function Mouth() {
  const stroke = {
    fill: "none",
    stroke: LINE,
    strokeWidth: 9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  return (
    <g transform={MOUTH}>
      <g data-mouth="smile" opacity="0">
        <path d="M-44-10Q0-2 44-10Q38 44 0 46Q-38 44-44-10Z" fill={LIP} />
        <path d="M-22 30Q0 14 22 30Q14 44 0 45Q-14 44-22 30Z" fill="#e57a72" />
      </g>
      <path data-mouth="grin" opacity="0" d="M-30-4Q0 22 30-4" {...stroke} />
      <ellipse data-mouth="o" opacity="0" rx="17" ry="22" fill={LIP} />
      <ellipse data-mouth="snore" opacity="0" rx="10" ry="12" fill={LIP} />
      <path data-mouth="cat" opacity="0" d="M-40-4Q-20 22 0-2Q20 22 40-4" {...stroke} />
      <path data-mouth="wave" opacity="0" d="M-42 4Q-31-10-21 4T0 4T21 4T42 4" {...stroke} />
    </g>
  );
}

/** The particle pool — every one parked invisible at the origin. */
function Fx() {
  const note = (
    <>
      <ellipse cx="0" cy="0" rx="21" ry="15" transform="rotate(-20)" />
      <rect x="12" y="-72" width="9" height="72" rx="4" />
      <path d="M17-72C40-62 50-44 40-26C38-40 30-48 17-50Z" />
    </>
  );
  const heart = "M0 30C-40 2-38-32-13-32C-4-32 0-25 0-19C0-25 4-32 13-32C38-32 40 2 0 30Z";
  const sparkle = "M0-40C4-8 8-4 40 0C8 4 4 8 0 40C-4 8-8 4-40 0C-8-4-4-8 0-40Z";
  const star = "M0-34L10-11L34-10L15 5L22 29L0 15L-22 29L-15 5L-34-10L-10-11Z";
  return (
    <g data-c="fx" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <g key={`n${i}`} data-c="fx-note" opacity="0" className="fill-accent">
          {note}
        </g>
      ))}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <path key={`h${i}`} data-c="fx-heart" opacity="0" d={heart} fill="#e8637a" />
      ))}
      {[0, 1, 2].map((i) => (
        <path key={`s${i}`} data-c="fx-sparkle" opacity="0" d={sparkle} fill="#f2b33d" />
      ))}
      {[0, 1, 2].map((i) => (
        <path key={`t${i}`} data-c="fx-star" opacity="0" d={star} fill="#f2b33d" />
      ))}
      {[0, 1, 2].map((i) => (
        <path
          key={`z${i}`}
          data-c="fx-z"
          opacity="0"
          d="M-16-16H16L-16 16H16"
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-fg-tertiary"
        />
      ))}
      <g data-c="fx-bang" opacity="0" className="fill-accent stroke-accent">
        <rect x="-11" y="-80" width="22" height="66" rx="11" stroke="none" />
        <circle cy="12" r="12" stroke="none" />
        <path
          d="M-46-64L-30-48M46-64L30-48M0-116V-96"
          strokeWidth="8"
          strokeLinecap="round"
          fill="none"
        />
      </g>
      <g data-c="fx-sweat" opacity="0">
        <path d="M0-36C12-13 23 2 23 14A23 23 0 0 1-23 14C-23 2-12-13 0-36Z" fill="#8cc8f2" />
        <ellipse cx="-8" cy="12" rx="5" ry="8" fill="#fff" opacity="0.7" />
      </g>
    </g>
  );
}

/**
 * fhf, drawn: the avatar traced into layers — hair, face, glasses, body —
 * with the eyes, cheeks and mouth as shapes the stage can swap. No frame:
 * he stands on the page itself, the shoulders fading out where the source
 * image cut them off.
 */
export function ChibiArt() {
  return (
    <svg
      viewBox="0 0 1254 1254"
      className="block h-full w-full overflow-visible"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id="chibi-lens">
          <path d={LENS_L} />
          <path d={LENS_R} />
        </clipPath>
        {/* The source is a crop: the shoulders run off its left and bottom
            edges. No frame to hide that behind, so the body fades out
            instead — under the chin, and toward the left. */}
        <linearGradient
          id="chibi-fade-y"
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="1120"
          x2="0"
          y2="1250"
        >
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor="#000" />
        </linearGradient>
        <linearGradient
          id="chibi-fade-x"
          gradientUnits="userSpaceOnUse"
          x1="40"
          y1="0"
          x2="380"
          y2="0"
        >
          <stop offset="0" stopColor="#000" />
          <stop offset="1" stopColor="#fff" />
        </linearGradient>
        <mask
          id="chibi-fade-under"
          maskUnits="userSpaceOnUse"
          x="-800"
          y="-800"
          width="2854"
          height="2854"
        >
          <rect x="-800" y="-800" width="2854" height="2854" fill="url(#chibi-fade-y)" />
        </mask>
        <mask
          id="chibi-fade-side"
          maskUnits="userSpaceOnUse"
          x="-800"
          y="-800"
          width="2854"
          height="2854"
        >
          <rect x="-800" y="-800" width="2854" height="2854" fill="url(#chibi-fade-x)" />
        </mask>
      </defs>

      <g mask="url(#chibi-fade-under)">
        <g data-c="squash">
          <g data-c="breath">
            <g mask="url(#chibi-fade-side)">
              <g data-c="body">
                <path d={JACKET} fill="#2b2727" />
                <path d={SHIRT} fill="#ece8e6" />
              </g>
            </g>
            <g data-c="head">
              <g data-c="head-look">
                <path d={FACE} fill="#e7c19f" />
                <path d={SHADE} fill="#d5a880" />
                <g data-c="cheeks">
                  <Cheek place={CHEEK_L} />
                  <Cheek place={CHEEK_R} />
                </g>
                <g data-c="mouth">
                  <Mouth />
                </g>
                <g data-c="eyes">
                  <Eye side="l" />
                  <Eye side="r" />
                </g>
                <g data-c="hair">
                  <g data-c="hair-act">
                    <path data-pat="" d={HAIR} fill="#332e2b" />
                    <path data-pat="" d={HIGHLIGHT} fill="#423a36" />
                    <g data-c="tuft">
                      <g data-c="tuft-sway">
                        <path data-pat="" d={TUFT} fill="#423a36" />
                      </g>
                    </g>
                  </g>
                </g>
                <g data-c="glasses">
                  <g data-c="glasses-act">
                    <g fill="none" stroke={FRAME} strokeWidth="15" strokeLinejoin="round">
                      <path d={LENS_L} />
                      <path d={LENS_R} />
                      <path d="M482 794Q520 798 558 818" strokeWidth="14" strokeLinecap="round" />
                    </g>
                    <g clipPath="url(#chibi-lens)">
                      <g transform="rotate(24 520 850)">
                        <rect
                          data-c="glint"
                          x="0"
                          y="450"
                          width="80"
                          height="800"
                          fill="#fff"
                          opacity="0"
                        />
                      </g>
                    </g>
                  </g>
                </g>
              </g>
            </g>
          </g>
        </g>
      </g>

      <Fx />
    </svg>
  );
}
