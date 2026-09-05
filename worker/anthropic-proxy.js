// Cloudflare Worker: holds the real Anthropic API key server-side and forwards
// requests from the Рецептник app's three AI features (dish search, "add from
// link", cart cost estimate) to the Anthropic Messages API.
//
// Why this exists: a static site can't call api.anthropic.com directly without
// either exposing a real API key to every visitor's dev tools, or relying on
// claude.ai's artifact sandbox (which only exists inside claude.ai). This
// Worker is the missing server piece — see DEPLOY.md in this folder for the
// exact deploy steps.

const ANTHROPIC_VERSION = "2023-06-01";

// Always "*" — deliberately, not a bug. Echoing back the request's actual
// Origin header looks more "secure" but breaks for pages opened as a local
// file (file://), where browsers send a literal "Origin: null" and then
// refuse a response that echoes "null" back. Since this endpoint sends no
// cookies and gates access with X-App-Token instead, a wildcard origin is
// safe here and works whether the site is opened locally or hosted anywhere.
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-App-Token",
  };
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders();

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: cors });
    }

    // Cheap gate against drive-by scanners hitting this URL directly (curl,
    // bots that scrape GitHub for open AI proxies). This is NOT real security —
    // the token lives in public frontend JS, so anyone who reads your source
    // has it too. The actual safety net is the spend limit on the Anthropic
    // key itself (set it in the Anthropic console — see DEPLOY.md step 4).
    if (env.APP_TOKEN && request.headers.get("X-App-Token") !== env.APP_TOKEN) {
      return new Response("Forbidden", { status: 403, headers: cors });
    }

    if (!env.ANTHROPIC_API_KEY) {
      return new Response("Server misconfigured: ANTHROPIC_API_KEY secret not set", {
        status: 500,
        headers: cors,
      });
    }

    let body;
    try {
      body = await request.text();
      JSON.parse(body); // just validating it's well-formed JSON before forwarding
    } catch (e) {
      return new Response("Invalid JSON body", { status: 400, headers: cors });
    }

    let upstream;
    try {
      upstream = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: body,
      });
    } catch (e) {
      return new Response("Upstream request failed: " + e.message, { status: 502, headers: cors });
    }

    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { "Content-Type": "application/json", ...cors },
    });
  },
};
