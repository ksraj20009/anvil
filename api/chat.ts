/**
 * ANVIL hosted proxy — a Vercel Edge Function.
 *
 *   POST /api/chat                 → chat completion (streaming or JSON)
 *   GET  /api/chat  (x-anvil-models: 1) → the provider's model list
 *
 * The browser sends the provider id in `x-anvil-provider`; this function looks
 * up the matching server-side key, forwards to the real provider, and streams
 * the response straight back. Keys never reach the client.
 *
 * Deploy-time setup: set OPENAI_API_KEY / ANTHROPIC_API_KEY / XAI_API_KEY in
 * your Vercel project's environment variables.
 */
export const config = { runtime: "edge" };

interface ProviderEntry {
  baseUrl: string;
  kind: "openai" | "anthropic";
  env: string;
}

const PROVIDERS: Record<string, ProviderEntry> = {
  sarvam: { baseUrl: "https://api.sarvam.ai/v2", kind: "openai", env: "SARVAM_API_KEY" },
  openai: { baseUrl: "https://api.openai.com/v1", kind: "openai", env: "OPENAI_API_KEY" },
  anthropic: { baseUrl: "https://api.anthropic.com/v1", kind: "anthropic", env: "ANTHROPIC_API_KEY" },
  xai: { baseUrl: "https://api.x.ai/v1", kind: "openai", env: "XAI_API_KEY" },
  google: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    kind: "openai",
    env: "GEMINI_API_KEY",
  },
  nvidia: { baseUrl: "https://integrate.api.nvidia.com/v1", kind: "openai", env: "NVIDIA_API_KEY" },
  mistral: { baseUrl: "https://api.mistral.ai/v1", kind: "openai", env: "MISTRAL_API_KEY" },
  deepseek: { baseUrl: "https://api.deepseek.com/v1", kind: "openai", env: "DEEPSEEK_API_KEY" },
  groq: { baseUrl: "https://api.groq.com/openai/v1", kind: "openai", env: "GROQ_API_KEY" },
  together: { baseUrl: "https://api.together.xyz/v1", kind: "openai", env: "TOGETHER_API_KEY" },
  fireworks: {
    baseUrl: "https://api.fireworks.ai/inference/v1",
    kind: "openai",
    env: "FIREWORKS_API_KEY",
  },
  openrouter: { baseUrl: "https://openrouter.ai/api/v1", kind: "openai", env: "OPENROUTER_API_KEY" },
  perplexity: { baseUrl: "https://api.perplexity.ai", kind: "openai", env: "PERPLEXITY_API_KEY" },
  cohere: {
    baseUrl: "https://api.cohere.ai/compatibility/v1",
    kind: "openai",
    env: "COHERE_API_KEY",
  },
  cerebras: { baseUrl: "https://api.cerebras.ai/v1", kind: "openai", env: "CEREBRAS_API_KEY" },
  huggingface: { baseUrl: "https://router.huggingface.co/v1", kind: "openai", env: "HF_TOKEN" },
  vercel: { baseUrl: "https://ai-gateway.vercel.sh/v1", kind: "openai", env: "AI_GATEWAY_API_KEY" },
  deepinfra: { baseUrl: "https://api.deepinfra.com/v1/openai", kind: "openai", env: "DEEPINFRA_API_KEY" },
  sambanova: { baseUrl: "https://api.sambanova.ai/v1", kind: "openai", env: "SAMBANOVA_API_KEY" },
  novita: { baseUrl: "https://api.novita.ai/v3/openai", kind: "openai", env: "NOVITA_API_KEY" },
  hyperbolic: { baseUrl: "https://api.hyperbolic.xyz/v1", kind: "openai", env: "HYPERBOLIC_API_KEY" },
  qwen: {
    baseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    kind: "openai",
    env: "DASHSCOPE_API_KEY",
  },
  moonshot: { baseUrl: "https://api.moonshot.cn/v1", kind: "openai", env: "MOONSHOT_API_KEY" },
  zhipu: { baseUrl: "https://open.bigmodel.cn/api/paas/v4", kind: "openai", env: "ZHIPU_API_KEY" },
  aimlapi: { baseUrl: "https://api.aimlapi.com/v1", kind: "openai", env: "AIMLAPI_KEY" },
};

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function authHeaders(entry: ProviderEntry, key: string): Record<string, string> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (entry.kind === "openai") {
    headers["authorization"] = `Bearer ${key}`;
  } else {
    headers["x-api-key"] = key;
    headers["anthropic-version"] = "2023-06-01";
  }
  return headers;
}

function passthrough(upstream: Response): Response {
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/json",
      "cache-control": "no-store",
    },
  });
}

export default async function handler(req: Request): Promise<Response> {
  const providerId = req.headers.get("x-anvil-provider") ?? "openai";
  const entry = PROVIDERS[providerId];
  if (!entry) return jsonError(`Unknown provider: ${providerId}`, 400);

  const key = process.env[entry.env];
  if (!key) {
    return jsonError(
      `This deployment has no ${entry.env} configured. Add it to your environment variables, or switch to "Bring your own key" in Settings.`,
      400
    );
  }

  // ---- Model listing -------------------------------------------------------
  if (req.method === "GET") {
    if (!req.headers.get("x-anvil-models")) return jsonError("Unsupported GET request.", 405);
    let upstream: Response;
    try {
      upstream = await fetch(`${entry.baseUrl}/models`, { headers: authHeaders(entry, key) });
    } catch (e) {
      return jsonError(`Upstream request failed: ${e instanceof Error ? e.message : String(e)}`, 502);
    }
    return passthrough(upstream);
  }

  if (req.method !== "POST") return jsonError("Method not allowed", 405);

  // ---- Chat completion -----------------------------------------------------
  const model = req.headers.get("x-anvil-model") ?? "";
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonError("Invalid JSON request body.", 400);
  }
  if (model) body.model = model;

  const url =
    entry.kind === "openai"
      ? `${entry.baseUrl}/chat/completions`
      : `${entry.baseUrl}/messages`;

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: "POST",
      headers: authHeaders(entry, key),
      body: JSON.stringify(body),
    });
  } catch (e) {
    return jsonError(`Upstream request failed: ${e instanceof Error ? e.message : String(e)}`, 502);
  }

  return passthrough(upstream);
}
