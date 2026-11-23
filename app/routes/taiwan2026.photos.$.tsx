// Serves a photo from the private R2 bucket, only to signed-in visitors.
// There is no public bucket URL; this route is the only way to fetch a photo.
import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { isAuthenticated } from "~/lib/taiwan-auth.server";

export async function loader({ request, params, context }: LoaderFunctionArgs) {
  const env = context.cloudflare.env;
  const noIndex = { "X-Robots-Tag": "noindex, nofollow" };

  if (!(await isAuthenticated(request, env))) {
    return new Response("Not authorized", { status: 401, headers: noIndex });
  }

  const name = params["*"] ?? "";
  if (!name || name.includes("..")) {
    return new Response("Not found", { status: 404, headers: noIndex });
  }

  const object = await env.PHOTOS.get(`photos/${name}`, {
    onlyIf: request.headers,
  });
  if (!object) {
    return new Response("Not found", { status: 404, headers: noIndex });
  }

  const headers = new Headers(noIndex);
  object.writeHttpMetadata(headers);
  headers.set("ETag", object.httpEtag);
  // `private` keeps photos out of shared/CDN caches; browsers may cache them.
  headers.set("Cache-Control", "private, max-age=86400");

  if (!("body" in object) || !object.body) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(object.body, { headers });
}
