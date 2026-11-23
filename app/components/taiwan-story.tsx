import { Form } from "@remix-run/react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Chapter, Photo, Story, StoryBlock } from "~/lib/taiwan-story.server";

/* ---------- Scroll-reveal ---------- */

// Content is visible during server render (and if JS fails). After hydration,
// blocks that are still below the fold fade/slide in as they're scrolled to.
function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"static" | "hidden" | "shown">("static");

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return; // already on screen
    setState("hidden");
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setState("shown");
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const motion =
    state === "hidden"
      ? "opacity-0 translate-y-8"
      : state === "shown"
        ? "opacity-100 translate-y-0"
        : "";
  return (
    <div ref={ref} className={`transition-all duration-700 ease-out ${motion} ${className}`}>
      {children}
    </div>
  );
}

/* ---------- Blocks ---------- */

const TILTS = ["-rotate-2", "rotate-1", "-rotate-1", "rotate-2", "rotate-0", "-rotate-[1.5deg]"];

function TextBlock({ paragraphs }: { paragraphs: string[] }) {
  return (
    <div className="mx-auto max-w-2xl space-y-5 text-lg leading-relaxed text-stone-700 sm:text-xl sm:leading-relaxed">
      {paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}

function BigPictureLabel() {
  return (
    <p className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
      The big picture
    </p>
  );
}

function GettyBlock({ block }: { block: Extract<StoryBlock, { type: "getty" }> }) {
  return (
    <figure className="mx-auto max-w-4xl">
      <BigPictureLabel />
      <div className="bg-white p-2 shadow-lg sm:p-3">
        <iframe
          src={block.src}
          title={block.caption || "Photo from Getty Images"}
          loading="lazy"
          scrolling="no"
          className="block w-full border-0"
          style={{ aspectRatio: `${block.width} / ${block.height}` }}
        />
      </div>
      <figcaption className="mt-3 text-center text-sm text-stone-600">
        {block.caption ? <span>{block.caption} · </span> : null}
        <span className="text-stone-500">
          Image via{" "}
          {block.detailUrl ? (
            <a href={block.detailUrl} target="_blank" rel="noreferrer" className="underline">
              Getty Images
            </a>
          ) : (
            "Getty Images"
          )}
        </span>
      </figcaption>
    </figure>
  );
}

function ImageBlock({ block }: { block: Extract<StoryBlock, { type: "image" }> }) {
  return (
    <figure className="mx-auto max-w-4xl">
      <BigPictureLabel />
      <div className="relative bg-white p-2 shadow-lg sm:p-3">
        <img src={block.src} alt={block.alt} loading="lazy" className="block w-full" />
        {block.credit ? (
          <span className="absolute bottom-4 right-4 max-w-[80%] rounded bg-black/60 px-2 py-1 text-[11px] leading-tight text-white/90 sm:bottom-5 sm:right-5 sm:text-xs">
            {block.creditUrl ? (
              <a href={block.creditUrl} target="_blank" rel="noreferrer" className="hover:underline">
                {block.credit}
              </a>
            ) : (
              block.credit
            )}
          </span>
        ) : null}
      </div>
      {block.caption ? (
        <figcaption className="mt-3 text-center text-sm text-stone-600">{block.caption}</figcaption>
      ) : null}
    </figure>
  );
}

function PhotosBlock({
  photos,
  indexOf,
  onOpen,
}: {
  photos: Photo[];
  indexOf: Map<string, number>;
  onOpen: (i: number) => void;
}) {
  const cols =
    photos.length === 1
      ? "max-w-md"
      : photos.length === 2
        ? "max-w-3xl sm:grid-cols-2"
        : "max-w-5xl sm:grid-cols-2 lg:grid-cols-3";
  return (
    <ul className={`mx-auto grid grid-cols-2 items-start gap-4 sm:gap-6 ${cols} ${photos.length === 1 ? "grid-cols-1" : ""}`}>
      {photos.map((p) => {
        const i = indexOf.get(p.name) ?? 0;
        return (
          <li key={p.name}>
            <button
              type="button"
              onClick={() => onOpen(i)}
              className={`block w-full ${TILTS[i % TILTS.length]} bg-white p-2 pb-3 text-left shadow-md transition hover:z-10 hover:rotate-0 hover:scale-[1.03] hover:shadow-xl focus:outline-none focus-visible:ring-4 focus-visible:ring-red-700/40`}
            >
              <img
                src={p.src}
                alt={p.caption || `Trip photo ${i + 1}`}
                loading="lazy"
                decoding="async"
                className="block w-full bg-stone-100"
              />
              {p.caption ? (
                <span className="mt-2 block px-1 text-center text-sm text-stone-600">{p.caption}</span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------- Chapter navigation ---------- */

function useActiveChapter(ids: string[]) {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    const onScroll = () => {
      const line = window.innerHeight * 0.35;
      let current: string | null = null;
      for (const el of els) if (el.getBoundingClientRect().top <= line) current = el.id;
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [ids]);
  return active;
}

function ChapterNav({ chapters, active }: { chapters: Chapter[]; active: string | null }) {
  const navRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Keep the active pill in view on narrow screens.
  useEffect(() => {
    if (!active) return;
    navRef.current
      ?.querySelector(`[data-ch="${active}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [active]);

  return (
    <nav
      aria-label="Chapters"
      className={`sticky top-0 z-40 border-b border-stone-300/60 bg-[#f6efe3]/90 backdrop-blur transition-opacity duration-300 ${active ? "opacity-100" : "pointer-events-none opacity-0"}`}
    >
      <div ref={navRef} className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-2 [scrollbar-width:none] sm:px-6">
        {chapters.map((c, i) => (
          <a
            key={c.id}
            href={`#${c.id}`}
            data-ch={c.id}
            className={`shrink-0 rounded-full px-3 py-1 text-sm transition ${
              active === c.id ? "bg-red-700 text-white" : "text-stone-600 hover:bg-white"
            }`}
          >
            <span className="mr-1 opacity-60">{i + 1}.</span>
            {c.title}
          </a>
        ))}
      </div>
      <div className="h-0.5 bg-red-700" style={{ width: `${progress * 100}%` }} />
    </nav>
  );
}

/* ---------- Lightbox ---------- */

function Lightbox({
  photos,
  index,
  setIndex,
}: {
  photos: Photo[];
  index: number | null;
  setIndex: (fn: (i: number | null) => number | null) => void;
}) {
  const step = useCallback(
    (d: number) => setIndex((i) => (i === null ? i : (i + d + photos.length) % photos.length)),
    [photos.length, setIndex],
  );

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIndex(() => null);
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [index, step, setIndex]);

  if (index === null) return null;
  const p = photos[index];
  const btn = "rounded-full bg-white/15 px-4 py-2 text-white hover:bg-white/25";
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4"
      onClick={() => setIndex(() => null)}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
      <img
        src={p.src}
        alt={p.caption || `Trip photo ${index + 1}`}
        className="max-h-[80vh] max-w-full object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      <p className="mt-3 text-center text-white/90">
        {p.caption}{" "}
        <span className="text-white/50">
          ({index + 1} / {photos.length})
        </span>
      </p>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div className="mt-4 flex gap-3" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={() => step(-1)} className={btn}>
          ← Prev
        </button>
        <button type="button" onClick={() => setIndex(() => null)} className={btn}>
          Close
        </button>
        <button type="button" onClick={() => step(1)} className={btn}>
          Next →
        </button>
      </div>
    </div>
  );
}

/* ---------- Page ---------- */

export function StoryView({ story }: { story: Story }) {
  const [open, setOpen] = useState<number | null>(null);
  const indexOf = useMemo(() => new Map(story.photos.map((p, i) => [p.name, i])), [story.photos]);
  const ids = useMemo(() => story.chapters.map((c) => c.id), [story.chapters]);
  const active = useActiveChapter(ids);

  return (
    <>
      {/* Cover */}
      <header className="relative flex min-h-[85vh] flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
        <Form method="post" className="absolute right-4 top-4 sm:right-6 sm:top-6">
          <input type="hidden" name="intent" value="logout" />
          <button
            type="submit"
            className="rounded-full border border-stone-300 px-3 py-1.5 text-sm text-stone-600 hover:bg-white"
          >
            Sign out
          </button>
        </Form>
        <p className="text-5xl" aria-hidden>
          🇹🇼
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">{story.title}</h1>
        {story.intro.length ? (
          <div className="mx-auto mt-6 max-w-2xl space-y-4 text-lg leading-relaxed text-stone-600 sm:text-xl">
            {story.intro.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        ) : null}
        {story.chapters.length > 1 ? (
          <ol className="mt-8 flex max-w-2xl flex-wrap justify-center gap-2 text-sm">
            {story.chapters.map((c, i) => (
              <li key={c.id}>
                <a href={`#${c.id}`} className="inline-block rounded-full bg-white/70 px-3 py-1 text-stone-700 shadow-sm hover:bg-white">
                  {i + 1}. {c.title}
                </a>
              </li>
            ))}
          </ol>
        ) : null}
        <p className="mt-12 animate-bounce text-sm text-stone-500 motion-reduce:animate-none">
          Scroll to begin ↓
        </p>
      </header>

      <ChapterNav chapters={story.chapters} active={active} />

      <main className="pb-24">
        {story.chapters.map((ch, ci) => (
          <section key={ch.id} id={ch.id} className="scroll-mt-14 px-4 pt-20 sm:px-6 sm:pt-28">
            <Reveal className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-red-700">
                Chapter {String(ci + 1).padStart(2, "0")}
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">{ch.title}</h2>
              {ch.subtitle ? <p className="mt-3 text-lg text-stone-500">{ch.subtitle}</p> : null}
              <div className="mx-auto mt-6 h-px w-16 bg-stone-400/60" />
            </Reveal>
            <div className="mt-10 space-y-12 sm:space-y-16">
              {ch.blocks.map((b, bi) => (
                <Reveal key={bi}>
                  {b.type === "text" ? (
                    <TextBlock paragraphs={b.paragraphs} />
                  ) : b.type === "getty" ? (
                    <GettyBlock block={b} />
                  ) : b.type === "image" ? (
                    <ImageBlock block={b} />
                  ) : (
                    <PhotosBlock photos={b.photos} indexOf={indexOf} onOpen={setOpen} />
                  )}
                </Reveal>
              ))}
            </div>
          </section>
        ))}

        {story.chapters.length === 0 ? (
          <p className="py-20 text-center text-stone-500">No photos yet. Check back soon!</p>
        ) : (
          <p className="mt-28 text-center text-stone-500">
            The end · Thanks for coming along! 👋
            <br />
            <a href="#top" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="mt-3 inline-block underline">
              Back to the top
            </a>
          </p>
        )}
      </main>

      <Lightbox photos={story.photos} index={open} setIndex={setOpen} />
    </>
  );
}
