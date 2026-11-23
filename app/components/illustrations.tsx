// Small hand-drawn illustrations for the scrapbook, drawn as inline SVG so
// they stay crisp at any size and need no image files.
import type { IllustrationName, StoryBlock } from "~/lib/taiwan-story.server";

const ANIM = `
@keyframes thl-sway { 0%,100% { transform: rotate(-4deg) } 50% { transform: rotate(4deg) } }
@keyframes thl-twinkle { 0%,100% { opacity: .25; transform: scale(.7) } 50% { opacity: 1; transform: scale(1) } }
.thl-sway { animation: thl-sway 3.2s ease-in-out infinite; transform-origin: 200px 300px; transform-box: view-box; }
.thl-star { animation: thl-twinkle 2.4s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
@media (prefers-reduced-motion: reduce) { .thl-sway, .thl-star { animation: none } }
`;

// One candy-coated berry with a happy face.
function Berry({ cy, face }: { cy: number; face: "smile" | "wow" | "wink" }) {
  return (
    <g>
      <circle cx={200} cy={cy} r={40} fill="url(#thl-berry)" />
      {/* Shiny sugar shell */}
      <circle cx={200} cy={cy} r={42} fill="none" stroke="#fff" strokeOpacity={0.55} strokeWidth={3} />
      <ellipse cx={184} cy={cy - 20} rx={13} ry={7} fill="#fff" opacity={0.85} transform={`rotate(-30 184 ${cy - 20})`} />
      <circle cx={170} cy={cy - 4} r={3} fill="#fff" opacity={0.8} />
      {/* Sugar drip */}
      <path d={`M226 ${cy + 28} q4 12 0 16 q-5 -4 0 -16 z`} fill="#fff" opacity={0.6} />
      {/* Face */}
      {face === "wink" ? (
        <path d={`M181 ${cy + 2} q6 -6 12 0`} fill="none" stroke="#3b1d1d" strokeWidth={3} strokeLinecap="round" />
      ) : (
        <circle cx={187} cy={cy + 1} r={4} fill="#3b1d1d" />
      )}
      <circle cx={213} cy={cy + 1} r={4} fill="#3b1d1d" />
      {face === "wow" ? (
        <ellipse cx={200} cy={cy + 14} rx={4} ry={5} fill="#3b1d1d" />
      ) : (
        <path d={`M193 ${cy + 11} q7 7 14 0`} fill="none" stroke="#3b1d1d" strokeWidth={3} strokeLinecap="round" />
      )}
      <ellipse cx={178} cy={cy + 12} rx={7} ry={4} fill="#ff8fa3" opacity={0.8} />
      <ellipse cx={222} cy={cy + 12} rx={7} ry={4} fill="#ff8fa3" opacity={0.8} />
    </g>
  );
}

function Sparkle({ x, y, s, delay }: { x: number; y: number; s: number; delay: number }) {
  return (
    <path
      className="thl-star"
      style={{ animationDelay: `${delay}s` }}
      d={`M${x} ${y - s} Q${x} ${y} ${x + s} ${y} Q${x} ${y} ${x} ${y + s} Q${x} ${y} ${x - s} ${y} Q${x} ${y} ${x} ${y - s} Z`}
      fill="#f5b700"
    />
  );
}

function Tanghulu() {
  return (
    <svg viewBox="0 0 400 340" role="img" aria-label="A cute cartoon tanghulu: three shiny red candied berries with happy faces on a stick" className="mx-auto block h-auto w-full max-w-[320px]">
      <style>{ANIM}</style>
      <defs>
        <radialGradient id="thl-berry" cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor="#ff6b6b" />
          <stop offset="0.6" stopColor="#e5383b" />
          <stop offset="1" stopColor="#a4161a" />
        </radialGradient>
      </defs>
      <circle cx={200} cy={170} r={150} fill="#fde2e4" />
      <Sparkle x={80} y={90} s={14} delay={0} />
      <Sparkle x={320} y={120} s={11} delay={0.8} />
      <Sparkle x={300} y={250} s={15} delay={1.4} />
      <Sparkle x={95} y={240} s={10} delay={0.4} />
      <g className="thl-sway">
        <rect x={195} y={20} width={10} height={300} rx={5} fill="#d4a373" stroke="#8d6748" strokeWidth={2} />
        <Berry cy={70} face="smile" />
        <Berry cy={150} face="wink" />
        <Berry cy={230} face="wow" />
      </g>
    </svg>
  );
}

const ART: Record<IllustrationName, () => JSX.Element> = { tanghulu: Tanghulu };

export function IllustrationBlock({ block }: { block: Extract<StoryBlock, { type: "illustration" }> }) {
  const Art = ART[block.name];
  return (
    <figure className="mx-auto max-w-sm">
      <Art />
      {block.caption ? (
        <figcaption className="mt-2 text-center text-sm text-stone-600">{block.caption}</figcaption>
      ) : null}
    </figure>
  );
}
