import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/cloudflare";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import {
  checkPassword,
  clearSessionCookie,
  createSessionCookie,
  isAuthenticated,
  isConfigured,
} from "~/lib/taiwan-auth.server";
import { loadStory } from "~/lib/taiwan-story.server";
import { StoryView } from "~/components/taiwan-story";

export const meta: MetaFunction = () => [
  { title: "Taiwan 2026 Scrapbook" },
  { name: "robots", content: "noindex, nofollow" },
];

export const headers: HeadersFunction = () => ({
  "X-Robots-Tag": "noindex, nofollow",
  "Cache-Control": "private, no-store",
});

export async function loader({ request, context }: LoaderFunctionArgs) {
  const env = context.cloudflare.env;
  if (!isConfigured(env)) {
    return { authed: false as const, ready: false as const, story: null };
  }
  if (!(await isAuthenticated(request, env))) {
    return { authed: false as const, ready: true as const, story: null };
  }
  return { authed: true as const, ready: true as const, story: await loadStory(env.PHOTOS) };
}

export async function action({ request, context }: ActionFunctionArgs) {
  const env = context.cloudflare.env;
  if (!isConfigured(env)) {
    return { error: "The scrapbook isn't open yet. Please check back soon." };
  }
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
      {!data.ready ? (
        <ComingSoon />
      ) : data.authed && data.story ? (
        <StoryView story={data.story} />
      ) : (
        <PasswordGate />
      )}
    </div>
  );
}

function ComingSoon() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm -rotate-1 rounded-sm bg-white p-8 text-center shadow-xl">
        <p className="text-4xl" aria-hidden>
          🇹🇼
        </p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight">Taiwan 2026 Scrapbook</h1>
        <p className="mt-2 text-stone-500">Coming soon! Check back in a little while.</p>
      </div>
    </main>
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
