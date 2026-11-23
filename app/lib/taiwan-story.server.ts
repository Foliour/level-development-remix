// Loads the scrapbook story (photos/story.json) and photo list from the
// private R2 bucket and turns it into a clean, validated structure for the page.
//
// The story lives in the bucket rather than the repo because the repo is
// public and the narrative may mention family members.
// See scripts/story.example.json for the format.

export type StoryBlock =
  | { type: "text"; paragraphs: string[] }
  | {
      type: "getty";
      src: string;
      detailUrl: string | null;
      width: number;
      height: number;
      caption: string;
    }
  | {
      type: "image";
      src: string;
      alt: string;
      caption: string;
      credit: string;
      creditUrl: string | null;
    }
  | { type: "photos"; photos: Photo[] }
  | { type: "illustration"; name: IllustrationName; caption: string }
  | {
      // Animated globe showing the flight path and day/night.
      type: "flight";
      from: FlightPlace;
      to: FlightPlace;
      departUtc: string; // ISO time of takeoff
      arriveUtc: string; // ISO time of landing
    };

// Hand-drawn illustrations built into the site (app/components/illustrations.tsx).
export const ILLUSTRATIONS = ["tanghulu"] as const;
export type IllustrationName = (typeof ILLUSTRATIONS)[number];

export type FlightPlace = {
  name: string; // e.g. "Washington, D.C."
  label: string; // e.g. "Home"
  coords: [number, number]; // [longitude, latitude]
  utcOffset: number; // hours, e.g. -5
};

export type Photo = { name: string; src: string; caption: string };

export type Chapter = {
  id: string;
  title: string;
  subtitle: string;
  blocks: StoryBlock[];
};

export type Story = {
  title: string;
  intro: string[];
  chapters: Chapter[];
  photos: Photo[]; // every photo in page order, for the lightbox
};

const IMAGE_RE = /\.(jpe?g|png|webp|gif|avif)$/i;
const PREFIX = "photos/";

/* eslint-disable @typescript-eslint/no-explicit-any */

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

const paragraphs = (v: unknown): string[] => {
  const raw = Array.isArray(v) ? v.map(str).join("\n\n") : str(v);
  return raw
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
};

const httpsUrl = (v: unknown): string | null => {
  try {
    const u = new URL(str(v));
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
};

const slug = (s: string, i: number) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || `chapter-${i + 1}`;

// Accepts either the embed code copied from Getty's "Embed" button
// (`</>` icon on an image page) or explicit { id, et, sig } fields.
function parseGetty(block: any): StoryBlock | null {
  const code = str(block.embed);
  const pick = (re: RegExp) => code.match(re)?.[1] ?? "";
  const items = str(block.id) || pick(/items\s*:\s*'([^']+)'/);
  const et = str(block.et) || pick(/[{,]\s*id\s*:\s*'([^']+)'/);
  const sig = str(block.sig) || pick(/sig\s*:\s*'([^']+)'/);
  const tld = pick(/tld\s*:\s*'([a-z.]+)'/) || "com";
  const width = Number(pick(/w\s*:\s*'(\d+)px'/)) || 594;
  const height = Number(pick(/h\s*:\s*'(\d+)px'/)) || 396;
  if (!items || !et || !sig) return null;

  const src =
    `https://embed.gettyimages.com/embed/${encodeURIComponent(items)}` +
    `?et=${encodeURIComponent(et)}&tld=${encodeURIComponent(tld)}` +
    `&sig=${encodeURIComponent(sig)}&caption=true&ver=1`;
  return {
    type: "getty",
    src,
    detailUrl: `https://www.gettyimages.com/detail/${encodeURIComponent(items)}`,
    width,
    height,
    caption: str(block.caption),
  };
}

function flightPlace(v: any): FlightPlace | null {
  const c = Array.isArray(v?.coords) ? v.coords.map(Number) : [];
  const offset = Number(v?.utcOffset);
  if (c.length !== 2 || !c.every(Number.isFinite) || !Number.isFinite(offset)) return null;
  return {
    name: str(v.name),
    label: str(v.label) || str(v.name),
    coords: [c[0], c[1]],
    utcOffset: offset,
  };
}

function photoFor(
  entry: any,
  available: Set<string>,
  captions: Record<string, string>,
): Photo | null {
  const name = typeof entry === "string" ? entry.trim() : str(entry?.file);
  if (!name || !available.has(name)) return null;
  const caption =
    (typeof entry === "object" && str(entry?.caption)) || captions[name] || "";
  return { name, src: `/taiwan2026/photos/${encodeURIComponent(name)}`, caption };
}

async function readJson(bucket: R2Bucket, key: string): Promise<any> {
  const obj = await bucket.get(key);
  if (!obj) return null;
  try {
    return await obj.json();
  } catch (e) {
    console.log(`Could not parse ${key}:`, e);
    return null;
  }
}

async function listPhotoNames(bucket: R2Bucket): Promise<string[]> {
  const names: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix: PREFIX, cursor });
    for (const o of page.objects) {
      const name = o.key.slice(PREFIX.length);
      if (IMAGE_RE.test(name) && !name.includes("/")) names.push(name);
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return names.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

export async function loadStory(bucket: R2Bucket): Promise<Story> {
  const [names, rawStory, rawCaptions] = await Promise.all([
    listPhotoNames(bucket),
    readJson(bucket, `${PREFIX}story.json`),
    readJson(bucket, `${PREFIX}captions.json`),
  ]);
  const captions: Record<string, string> =
    rawCaptions && typeof rawCaptions === "object" ? rawCaptions : {};
  const available = new Set(names);
  const used = new Set<string>();

  const chapters: Chapter[] = [];
  const rawChapters: any[] = Array.isArray(rawStory?.chapters) ? rawStory.chapters : [];

  rawChapters.forEach((ch, i) => {
    const title = str(ch?.title) || `Chapter ${i + 1}`;
    const blocks: StoryBlock[] = [];
    for (const b of Array.isArray(ch?.blocks) ? ch.blocks : []) {
      switch (b?.type) {
        case "text": {
          const p = paragraphs(b.text);
          if (p.length) blocks.push({ type: "text", paragraphs: p });
          break;
        }
        case "getty": {
          const g = parseGetty(b);
          if (g) blocks.push(g);
          else console.log(`Skipping Getty block in "${title}": embed code not recognised`);
          break;
        }
        case "image": {
          const src = httpsUrl(b.src);
          if (!src) break;
          blocks.push({
            type: "image",
            src,
            alt: str(b.alt) || str(b.caption) || title,
            caption: str(b.caption),
            credit: str(b.credit),
            creditUrl: httpsUrl(b.creditUrl),
          });
          break;
        }
        case "illustration": {
          const name = str(b.name) as IllustrationName;
          if (ILLUSTRATIONS.includes(name)) {
            blocks.push({ type: "illustration", name, caption: str(b.caption) });
          } else {
            console.log(`Skipping illustration "${name}" in "${title}": unknown name`);
          }
          break;
        }
        case "flight": {
          const from = flightPlace(b.from);
          const to = flightPlace(b.to);
          const depart = Date.parse(str(b.departUtc));
          const arrive = Date.parse(str(b.arriveUtc));
          if (!from || !to || !(arrive > depart)) {
            console.log(`Skipping flight block in "${title}": needs from, to, departUtc, arriveUtc`);
            break;
          }
          blocks.push({
            type: "flight",
            from,
            to,
            departUtc: new Date(depart).toISOString(),
            arriveUtc: new Date(arrive).toISOString(),
          });
          break;
        }
        case "photos": {
          const photos = (Array.isArray(b.files) ? b.files : [])
            .map((f: any) => photoFor(f, available, captions))
            .filter((p: Photo | null): p is Photo => !!p && !used.has(p.name));
          photos.forEach((p: Photo) => used.add(p.name));
          if (photos.length) blocks.push({ type: "photos", photos });
          break;
        }
      }
    }
    chapters.push({ id: slug(title, i), title, subtitle: str(ch?.subtitle), blocks });
  });

  // Any uploaded photo not placed in a chapter still shows up at the end,
  // so nothing silently disappears.
  const leftovers = names
    .filter((n) => !used.has(n))
    .map((n) => photoFor(n, available, captions))
    .filter((p): p is Photo => !!p);
  if (leftovers.length) {
    chapters.push({
      id: "more-photos",
      title: chapters.length ? "More photos" : "Our photos",
      subtitle: "",
      blocks: [{ type: "photos", photos: leftovers }],
    });
  }

  const photos = chapters.flatMap((c) =>
    c.blocks.flatMap((b) => (b.type === "photos" ? b.photos : [])),
  );

  return {
    title: str(rawStory?.title) || "Our Taiwan Adventure",
    intro: paragraphs(rawStory?.intro),
    chapters,
    photos,
  };
}
