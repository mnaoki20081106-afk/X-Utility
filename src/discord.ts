export type DiscordEnv = {
  DISCORD_BOT_TOKEN: string;
  DISCORD_APPLICATION_ID: string;
  DISCORD_PUBLIC_KEY: string;
};

const DISCORD_API = "https://discord.com/api/v10";

function hexToBytes(value: string): Uint8Array {
  const clean = value.trim();
  if (!/^[0-9a-f]+$/i.test(clean) || clean.length % 2 !== 0) {
    throw new Error("invalid hex");
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function asBuffer(value: Uint8Array): ArrayBuffer {
  return value.buffer.slice(
    value.byteOffset,
    value.byteOffset + value.byteLength
  ) as ArrayBuffer;
}

export async function verifyInteraction(
  env: DiscordEnv,
  request: Request,
  body: string
): Promise<boolean> {
  const signature = request.headers.get("X-Signature-Ed25519");
  const timestamp = request.headers.get("X-Signature-Timestamp");
  if (!signature || !timestamp) return false;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      asBuffer(hexToBytes(env.DISCORD_PUBLIC_KEY)),
      { name: "Ed25519" } as AlgorithmIdentifier,
      false,
      ["verify"]
    );
    const message = new TextEncoder().encode(timestamp + body);
    return await crypto.subtle.verify(
      { name: "Ed25519" } as AlgorithmIdentifier,
      key,
      asBuffer(hexToBytes(signature)),
      asBuffer(message)
    );
  } catch {
    return false;
  }
}

export async function discordFetch(
  env: Pick<DiscordEnv, "DISCORD_BOT_TOKEN">,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", "Bot " + env.DISCORD_BOT_TOKEN.trim());
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(DISCORD_API + path, { ...init, headers });
  return response;
}

export async function discordJson<T>(
  env: Pick<DiscordEnv, "DISCORD_BOT_TOKEN">,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await discordFetch(env, path, init);
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      "Discord API " + response.status + ": " + detail.slice(0, 300)
    );
  }
  return response.json() as Promise<T>;
}

export async function editOriginalInteraction(
  interaction: { application_id?: string; token?: string },
  payload: unknown
): Promise<void> {
  const applicationId = String(interaction.application_id ?? "").trim();
  const token = String(interaction.token ?? "").trim();
  if (!applicationId || !token) {
    throw new Error("interaction callback metadata missing");
  }
  const response = await fetch(
    DISCORD_API +
      "/webhooks/" +
      encodeURIComponent(applicationId) +
      "/" +
      encodeURIComponent(token) +
      "/messages/@original",
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      "Discord interaction update " +
        response.status +
        ": " +
        detail.slice(0, 300)
    );
  }
}

export function discordInteractionResponse(
  payload: unknown,
  status = 200
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
