/**
 * Cloudflare Worker – Tem Gelo? publish endpoint
 *
 * Secrets to set in the Worker:
 *   ADMIN_PASSWORD
 *   CLOUDINARY_CLOUD_NAME   (= efvlvhce)
 *   CLOUDINARY_API_KEY
 *   CLOUDINARY_API_SECRET
 *
 * Deploy with: wrangler deploy
 * Then set PUBLISH_URL in admin.js to https://your-worker.xxx.workers.dev/publish
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function respond(body, status = 200) {
  const isString = typeof body === "string";
  return new Response(isString ? body : JSON.stringify(body), {
    status,
    headers: {
      ...CORS,
      "Content-Type": isString ? "text/plain; charset=utf-8" : "application/json"
    }
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (request.method !== "POST" || !new URL(request.url).pathname.endsWith("/publish")) {
      return respond("Not found", 404);
    }

    try {
      const body = await request.json();
      if (body.password !== env.ADMIN_PASSWORD) {
        return respond("Unauthorized", 401);
      }

      const catalog = body.catalog;
      if (!catalog || !Array.isArray(catalog.sellers)) {
        return respond("Invalid catalog", 400);
      }

      const timestamp = Math.floor(Date.now() / 1000);
      const publicId = "gelo/catalog";

      const paramsToSign = `overwrite=true&public_id=${publicId}&timestamp=${timestamp}`;
      const signature = await sign(paramsToSign + env.CLOUDINARY_API_SECRET);

      const form = new FormData();
      form.append("file", new Blob([JSON.stringify(catalog)], { type: "application/json" }), "catalog.json");
      form.append("api_key", env.CLOUDINARY_API_KEY);
      form.append("timestamp", String(timestamp));
      form.append("signature", signature);
      form.append("public_id", publicId);
      form.append("overwrite", "true");
      form.append("resource_type", "raw");

      const cloudRes = await fetch(
        `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/raw/upload`,
        { method: "POST", body: form }
      );

      if (!cloudRes.ok) {
        const errText = await cloudRes.text();
        return respond("Cloudinary error: " + errText, 500);
      }

      return respond({ ok: true });
    } catch (err) {
      return respond("Error: " + err.message, 500);
    }
  }
};

async function sign(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hash = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
