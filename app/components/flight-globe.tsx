// Animated globe for the scrapbook: the plane flies the great-circle route
// while night sweeps across the Earth in real time, and a clock for each city
// shows the local day and time. Built for 5- and 6-year-olds.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  geoCircle,
  geoDistance,
  geoGraticule10,
  geoInterpolate,
  geoOrthographic,
  geoPath,
} from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { FeatureCollection } from "geojson";
import countriesTopo from "world-atlas/countries-110m.json";
import type { FlightPlace, StoryBlock } from "~/lib/taiwan-story.server";

type FlightBlock = Extract<StoryBlock, { type: "flight" }>;

const SIZE = 500;
const RADIUS = 228;
const FLIGHT_MS = 11000;
const HOUR = 3600_000;
const USA = "840";
const TAIWAN = "158";
const PLANE =
  "M24 0 L10 -3.5 L-2 -18 L-8 -18 L-2 -3.5 L-14 -3.5 L-19 -10 L-23 -10 L-20 0 L-23 10 L-19 10 L-14 3.5 L-2 3.5 L-8 18 L-2 18 L10 3.5 Z";

const topo = countriesTopo as unknown as Topology<{ countries: GeometryCollection }>;
const countries = feature(topo, topo.objects.countries) as FeatureCollection;
const graticule = geoGraticule10();

// Where the sun is directly overhead at a given moment (good to ~1°).
function subsolarPoint(ms: number): [number, number] {
  const d = new Date(ms);
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const day = (ms - start) / (24 * HOUR);
  const rad = Math.PI / 180;
  const decl = -23.44 * Math.cos(rad * (360 / 365) * (day + 10));
  const b = rad * (360 / 365) * (day - 81);
  const eotMin = 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
  const utcHours = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
  let lon = -15 * (utcHours - 12 + eotMin / 60);
  lon = ((lon + 540) % 360) - 180;
  return [lon, decl];
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function localTime(ms: number, offset: number) {
  const d = new Date(ms + offset * HOUR);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return {
    day: DAYS[d.getUTCDay()],
    time: `${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`,
  };
}

function skyAt(place: FlightPlace, sun: [number, number]) {
  // Angle between the place and the point under the sun: < 90° means daytime.
  const deg = (geoDistance(place.coords, sun) * 180) / Math.PI;
  if (Math.abs(deg - 90) < 7) return { icon: "🌅", word: deg < 90 ? "Sunset or sunrise" : "Twilight" };
  return deg < 90 ? { icon: "☀️", word: "Daytime" } : { icon: "🌙", word: "Nighttime" };
}

function CityClock({ place, ms, sun }: { place: FlightPlace; ms: number; sun: [number, number] }) {
  const { day, time } = localTime(ms, place.utcOffset);
  const sky = skyAt(place, sun);
  return (
    <div className="flex-1 rounded-xl bg-white/90 px-3 py-2 text-center shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">{place.label}</p>
      <p className="text-sm text-stone-600">{place.name}</p>
      <p className="mt-1 text-2xl" aria-hidden>
        {sky.icon}
      </p>
      <p className="text-lg font-bold tabular-nums text-stone-800 sm:text-xl">{time}</p>
      <p className="text-sm text-stone-600">{day}</p>
    </div>
  );
}

export function FlightGlobe({ block }: { block: FlightBlock }) {
  const wrapRef = useRef<HTMLElement>(null);
  const raf = useRef<number>();
  const [t, setT] = useState(0);

  const depart = Date.parse(block.departUtc);
  const arrive = Date.parse(block.arriveUtc);
  const hours = Math.round((arrive - depart) / HOUR);
  const interp = useMemo(
    () => geoInterpolate(block.from.coords, block.to.coords),
    [block.from.coords, block.to.coords],
  );

  const fly = useCallback(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setT(1);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const x = Math.min(1, (now - start) / FLIGHT_MS);
      setT(x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2); // ease in-out
      if (x < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          fly();
          io.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [fly]);

  const now = depart + t * (arrive - depart);
  const sun = subsolarPoint(now);
  const night = useMemo(
    () => geoCircle().center([sun[0] + 180, -sun[1]]).radius(90)(),
    [sun[0], sun[1]], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const planeAt = interp(t);

  // Keep the plane near the middle, tilted a little so the north shows.
  const projection = geoOrthographic()
    .scale(RADIUS)
    .translate([SIZE / 2, SIZE / 2])
    .rotate([-planeAt[0], -Math.min(55, Math.max(15, planeAt[1])), 0])
    .clipAngle(90);
  const path = geoPath(projection);
  const center = projection.invert?.([SIZE / 2, SIZE / 2]) ?? planeAt;
  const visible = (p: [number, number]) => geoDistance(p, center) < Math.PI / 2 - 0.02;

  const route = { type: "LineString" as const, coordinates: [block.from.coords, block.to.coords] };
  const steps = Math.max(2, Math.ceil(t * 64));
  const flown = {
    type: "LineString" as const,
    coordinates: Array.from({ length: steps + 1 }, (_, i) => interp((t * i) / steps)),
  };

  const planeXY = projection(planeAt) ?? [SIZE / 2, SIZE / 2];
  const aheadXY = projection(interp(Math.min(1, t + 0.01))) ?? planeXY;
  const behindXY = projection(interp(Math.max(0, t - 0.01))) ?? planeXY;
  const heading =
    (Math.atan2(aheadXY[1] - behindXY[1], aheadXY[0] - behindXY[0]) * 180) / Math.PI;

  const landed = t >= 1;
  const hoursFlown = Math.floor(t * hours + 1e-9);
  const arriveLocal = localTime(arrive, block.to.utcOffset);
  const arriveHome = localTime(arrive, block.from.utcOffset);
  const summary =
    `A globe showing our plane flying ${hours} hours from ${block.from.name} to ${block.to.name}. ` +
    `When we landed it was ${arriveLocal.time} on ${arriveLocal.day} in ${block.to.name}, ` +
    `but ${arriveHome.time} on ${arriveHome.day} at home.`;

  const cities: FlightPlace[] = [block.from, block.to];

  return (
    <figure ref={wrapRef} className="mx-auto max-w-3xl">
      <div className="overflow-hidden rounded-2xl bg-[#0b1430] p-3 shadow-lg sm:p-5">
        <p className="text-center text-xl font-bold text-white sm:text-2xl" aria-live="off">
          {landed ? "We made it! 🎉" : `${hoursFlown} ${hoursFlown === 1 ? "hour" : "hours"} in the air ✈️`}
        </p>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={summary} className="mx-auto mt-2 block h-auto w-full max-w-[460px]">
          <defs>
            <radialGradient id="globe-ocean" cx="40%" cy="35%" r="70%">
              <stop offset="0" stopColor="#5fb3e6" />
              <stop offset="1" stopColor="#1d5f9e" />
            </radialGradient>
          </defs>
          {[[30, 40], [460, 70], [70, 460], [440, 430], [250, 14], [20, 260], [486, 250], [120, 110], [400, 20]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={i % 3 ? 1.2 : 2} fill="#fff" opacity={0.7} />
          ))}
          <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="url(#globe-ocean)" />
          <path d={path(graticule) ?? ""} fill="none" stroke="#fff" strokeOpacity={0.12} strokeWidth={0.8} />
          {countries.features.map((f, i) => {
            const id = String(f.id);
            const fill = id === USA ? "#e8a84a" : id === TAIWAN ? "#e2574c" : "#7fb069";
            return <path key={i} d={path(f) ?? ""} fill={fill} stroke="#2f4f3a" strokeOpacity={0.35} strokeWidth={0.5} />;
          })}
          <path d={path(night) ?? ""} fill="#0b1430" fillOpacity={0.55} />
          <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="#9cc9ee" strokeOpacity={0.6} strokeWidth={2} />

          <path d={path(route) ?? ""} fill="none" stroke="#fff" strokeOpacity={0.75} strokeWidth={3} strokeDasharray="1 9" strokeLinecap="round" />
          <path d={path(flown) ?? ""} fill="none" stroke="#fff" strokeWidth={3.5} strokeLinecap="round" />

          {cities.map((c) => {
            if (!visible(c.coords)) return null;
            const [x, y] = projection(c.coords) ?? [0, 0];
            const right = x < SIZE / 2;
            return (
              <g key={c.name}>
                <circle cx={x} cy={y} r={6} fill="#fff" stroke="#0b1430" strokeWidth={2} />
                <text
                  x={x + (right ? 12 : -12)}
                  y={y + 5}
                  textAnchor={right ? "start" : "end"}
                  fontSize={18}
                  fontWeight={700}
                  fill="#fff"
                  stroke="#0b1430"
                  strokeWidth={4}
                  style={{ paintOrder: "stroke" }}
                >
                  {c.label}
                </text>
              </g>
            );
          })}

          <g transform={`translate(${planeXY[0]} ${planeXY[1]}) rotate(${heading}) scale(1.1)`}>
            <path d={PLANE} fill="#fff" stroke="#0b1430" strokeWidth={2} strokeLinejoin="round" />
          </g>
        </svg>
        <div className="mt-3 flex gap-3">
          <CityClock place={block.from} ms={now} sun={sun} />
          <CityClock place={block.to} ms={now} sun={sun} />
        </div>
      </div>
      <figcaption className="mt-3 space-y-2 text-center text-sm text-stone-600">
        <p>
          The white line is the way our plane flew. The dark side of the globe is where it is
          nighttime.
          {landed
            ? ` When we landed it was ${arriveLocal.time} on ${arriveLocal.day} in Taiwan, but still ${arriveHome.time} on ${arriveHome.day} at home!`
            : ""}
        </p>
        <button
          type="button"
          onClick={fly}
          className="rounded-full border border-stone-300 bg-white px-3 py-1 text-stone-700 shadow-sm hover:bg-stone-50"
        >
          ✈️ Fly again
        </button>
      </figcaption>
    </figure>
  );
}
