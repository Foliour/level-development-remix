import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/cloudflare";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { useCallback, useEffect, useState } from "react";
import {
  checkPassword,
  clearSessionCookie,
  createSessionCookie,
  isAuthenticated,
} from "~/lib/taiwan-auth.server";

type Photo = { name: string; src: string; caption: string };

export const meta: MetaFunction = () => [
  { title: "Taiwan 2026 Scrapbook" },
  { name: "robots", content: "noindex, nofollow" },
];

export const headers: HeadersFunction = () => ({
  "X-Robots-Tag": "noindex, nofollow",
  "Cache-Control": "private, no-store",
});

const IMAGE_RE = /\.(jpe?g|png|webp|gif|avif)$/i;

export async function loader({ request, context }: LoaderFunctionArgs) {
  const env = context.cloudflare.env;
  if (!(await isAuthenticated(request, env))) {
    return { authed: false as const, photos: [] as Photo[] };
  }

  // Optional captions: upload `photos/captions.json` as { "file.jpg": "Caption" }.
  let captions: Record<string, string> = {};
  const captionsObj = await env.PHOTOS.get("photos/captions.json");
  if (captionsObj) {
    try {
      captions = await captionsObj.json();
    } catch {
      captions = {};
    }
  }

  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await env.PHOTOS.list({ prefix: "photos/", cursor });
    for (const obj of page.objects) keys.push(obj.key);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  const photos: Photo[] = keys
    .map((key) => key.slice("photos/".length))
    .filter((name) => IMAGE_RE.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((name) => ({
      name,
      src: `/taiwan2026/photos/${encodeURIComponent(name)}`,
      caption: captions[name] ?? "",
    }));

  return { authed: true as const, photos };
}

export async function action({ request, context }: ActionFunctionArgs) {
  const env = context.cloudflare.env;
  const form = await request.formData();

  if (form.get("intent") === "logout") {
    return new Response(null, {
      status: 303,
      headers: { Location: "/taiwan2026", "Set-Cookie": clearSessionCookie(request) },
    });
  }

  const password = String(form.get("password") ?? "");
  if (!(await checkPassword(password, env))) {
    // Small delay to slow down guessing.
    await new Promise((r) => setTimeout(r, 800));
    return { error: "That password didn't work. Please try again." };
  }

  return new Response(null, {
    status: 303,
    headers: {
      Location: "/taiwan2026",
      "Set-Cookie": await createSessionCookie(request, env),
    },
  });
}

export default function Taiwan2026() {
  const data = useLoaderData<typeof loader>();
  return (
    <div className="min-h-screen bg-[#f6efe3] text-stone-800">
      {data.authed ? <Scrapbook photos={data.photos} /> : <PasswordGate />}
    </div>
  );
}

function PasswordGate() {
  const actionData = useActionData<{ error?: string }>();
  const nav = useNavigation();
  const busy = nav.state !== "idle";
  const error = actionData?.error ?? null;

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm -rotate-1 rounded-sm bg-white p-8 shadow-xl">
        <p className="text-center text-4xl" aria-hidden>
          🇹🇼
        </p>
        <h1 className="mt-3 text-center text-2xl font-bold tracking-tight">
          Taiwan 2026 Scrapbook
        </h1>
        <p className="mt-2 text-center text-sm text-stone-500">
          Enter the class password to see the photos.
        </p>
        <Form method="post" className="mt-6 space-y-3">
          <label htmlFor="password" className="sr-only">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            autoFocus
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-base outline-none focus:border-red-700 focus:ring-2 focus:ring-red-700/20"
          />
          {error ? (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-red-700 px-4 py-2 font-medium text-white transition hover:bg-red-800 disabled:opacity-60"
          >
            {busy ? "Checking…" : "Open scrapbook"}
          </button>
        </Form>
      </div>
    </main>
  );
}

const TILTS = ["-rotate-2", "rotate-1", "-rotate-1", "rotate-2", "rotate-0", "-rotate-[1.5deg]"];

function Scrapbook({ photos }: { photos: Photo[] }) {
  const [open, setOpen] = useState<number | null>(null);

  const step = useCallback(
    (delta: number) =>
      setOpen((i) => (i === null ? i : (i + delta + photos.length) % photos.length)),
    [photos.length],
  );

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, step]);

  return (
    <>
      <header className="mx-auto flex max-w-6xl items-start justify-between gap-4 px-4 pb-6 pt-10 sm:px-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Our Taiwan Adventure 🇹🇼
          </h1>
          <p className="mt-2 text-stone-600">
            {photos.length} photos from our trip. Tap any photo to see it bigger.
          </p>
        </div>
        <Form method="post">
          <input type="hidden" name="intent" value="logout" />
          <button
            type="submit"
            className="shrink-0 rounded-full border border-stone-300 px-3 py-1.5 text-sm text-stone-600 hover:bg-white"
          >
            Sign out
          </button>
        </Form>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        {photos.length === 0 ? (
          <p className="py-20 text-center text-stone-500">
            No photos yet. Check back soon!
          </p>
        ) : (
          <ul className="columns-2 gap-4 sm:columns-3 lg:columns-4">
            {photos.map((p, i) => (
              <li key={p.name} className="mb-5 break-inside-avoid">
                <button
                  type="button"
                  onClick={() => setOpen(i)}
                  className={`block w-full ${TILTS[i % TILTS.length]} bg-white p-2 pb-3 text-left shadow-md transition hover:z-10 hover:rotate-0 hover:scale-[1.03] hover:shadow-xl focus:outline-none focus-visible:ring-4 focus-visible:ring-red-700/40`}
                >
                  <img
                    src={p.src}
                    alt={p.caption || `Taiwan trip photo ${i + 1}`}
                    loading="lazy"
                    decoding="async"
                    className="block w-full bg-stone-100"
                  />
                  {p.caption ? (
                    <span className="mt-2 block px-1 text-center text-sm text-stone-600">
                      {p.caption}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      {open !== null ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4"
          onClick={() => setOpen(null)}
        >
          <img
            src={photos[open].src}
            alt={photos[open].caption || `Taiwan trip photo ${open + 1}`}
            className="max-h-[80vh] max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <p className="mt-3 text-center text-white/90">
            {photos[open].caption}{" "}
            <span className="text-white/50">
              ({open + 1} / {photos.length})
            </span>
          </p>
          <div className="mt-4 flex gap-3" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => step(-1)} className="rounded-full bg-white/15 px-4 py-2 text-white hover:bg-white/25">
              ← Prev
            </button>
            <button type="button" onClick={() => setOpen(null)} className="rounded-full bg-white/15 px-4 py-2 text-white hover:bg-white/25">
              Close
            </button>
            <button type="button" onClick={() => step(1)} className="rounded-full bg-white/15 px-4 py-2 text-white hover:bg-white/25">
              Next →
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
