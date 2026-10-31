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

export default {
  async fetch(request, env) {
    // CORS
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }

    if (request.method !== "POST" || !request.url.endsWith("/publish")) {
      return new Response("Not found", { status: 404 });
    }

    try {
      const body = await request.json();
      if (body.password !== env.ADMIN_PASSWORD) {
        return new Response("Unauthorized", { status: 401 });
      }

      const catalog = body.catalog;
      if (!catalog || !Array.isArray(catalog.sellers)) {
        return new Response("Invalid catalog", { status: 400 });
      }

      // Upload as raw to Cloudinary (overwrite)
      const timestamp = Math.floor(Date.now() / 1000);
      const publicId = "gelo/catalog";
      const folder = "gelo";

      // Signature for signed upload
      const paramsToSign = `overwrite=true&public_id=${publicId}&timestamp=${timestamp}`;
      const signature = await sign(paramsToSign + env.CLOUDINARY_API_SECRET);

      const form = new FormData();
      form.append("file", new Blob([JSON.stringify(catalog)], { type: "application/json" }), "catalog.json");
      form.append("api_key", env.CLOUDINARY_API_KEY);
      form.append("timestamp", timestamp);
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
        return new Response("Cloudinary error: " + errText, { status: 500 });
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    } catch (err) {
      return new Response("Error: " + err.message, { status: 500 });
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
