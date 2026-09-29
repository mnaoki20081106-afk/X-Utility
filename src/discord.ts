export type DiscordEnv = {
  DISCORD_BOT_TOKEN: string;
  DISCORD_APPLICATION_ID: string;
  DISCORD_PUBLIC_KEY?: string;
};

const DISCORD_API = "https://discord.com/api/v10";
let cachedVerifyKey = "";
let cachedApplicationId = "";

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

async function verifyWithKey(
  publicKeyHex: string,
  signatureHex: string,
  timestamp: string,
  body: string
): Promise<boolean> {
  if (!/^[0-9a-f]{64}$/i.test(publicKeyHex.trim())) return false;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      asBuffer(hexToBytes(publicKeyHex)),
      { name: "Ed25519" } as AlgorithmIdentifier,
      false,
      ["verify"]
    );
    const message = new TextEncoder().encode(timestamp + body);
    return await crypto.subtle.verify(
      { name: "Ed25519" } as AlgorithmIdentifier,
      key,
      asBuffer(hexToBytes(signatureHex)),
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
  return fetch(DISCORD_API + path, { ...init, headers });
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

type CurrentApplication = {
  id: string;
  verify_key?: string;
  interactions_endpoint_url?: string | null;
};

async function fetchCurrentApplication(
  env: DiscordEnv
): Promise<CurrentApplication> {
  const application = await discordJson<CurrentApplication>(
    env,
    "/oauth2/applications/@me"
  );
  const verifyKey = String(application.verify_key ?? "").trim();
  if (/^[0-9a-f]{64}$/i.test(verifyKey)) {
    cachedVerifyKey = verifyKey;
    cachedApplicationId = String(application.id ?? "").trim();
  }
  return application;
}

async function resolveVerifyKey(env: DiscordEnv): Promise<string> {
  const applicationId = env.DISCORD_APPLICATION_ID?.trim() ?? "";
  if (
    cachedVerifyKey &&
    cachedApplicationId &&
    (!applicationId || cachedApplicationId === applicationId)
  ) {
    return cachedVerifyKey;
  }

  const application = await fetchCurrentApplication(env);
  if (
    applicationId &&
    String(application.id ?? "").trim() !== applicationId
  ) {
    throw new Error("DISCORD_APPLICATION_ID_MISMATCH");
  }

  const verifyKey = String(application.verify_key ?? "").trim();
  if (!/^[0-9a-f]{64}$/i.test(verifyKey)) {
    throw new Error("DISCORD_VERIFY_KEY_UNAVAILABLE");
  }
  return verifyKey;
}

export async function verifyInteraction(
  env: DiscordEnv,
  request: Request,
  body: string
): Promise<boolean> {
  const signature = request.headers.get("X-Signature-Ed25519")?.trim() ?? "";
  const timestamp = request.headers.get("X-Signature-Timestamp")?.trim() ?? "";
  if (!/^[0-9a-f]{128}$/i.test(signature) || !timestamp) return false;

  const configured = env.DISCORD_PUBLIC_KEY?.trim() ?? "";
  if (
    /^[0-9a-f]{64}$/i.test(configured) &&
    (await verifyWithKey(configured, signature, timestamp, body))
  ) {
    return true;
  }

  if (
    cachedVerifyKey &&
    cachedVerifyKey.toLowerCase() !== configured.toLowerCase() &&
    (await verifyWithKey(cachedVerifyKey, signature, timestamp, body))
  ) {
    return true;
  }

  try {
    const resolved = await resolveVerifyKey(env);
    if (
      resolved.toLowerCase() !== configured.toLowerCase() &&
      (await verifyWithKey(resolved, signature, timestamp, body))
    ) {
      return true;
    }
  } catch {
    // Invalid requests must still fail closed.
  }

  return false;
}

export async function ensureInteractionsEndpoint(
  env: DiscordEnv,
  workerOrigin: string
): Promise<{
  applicationId: string;
  verifyKeyAvailable: boolean;
  endpoint: string;
  changed: boolean;
}> {
  const application = await fetchCurrentApplication(env);
  const applicationId = String(application.id ?? "").trim();
  const expectedApplicationId = env.DISCORD_APPLICATION_ID?.trim() ?? "";
  if (expectedApplicationId && applicationId !== expectedApplicationId) {
    throw new Error("DISCORD_APPLICATION_ID_MISMATCH");
  }

  const expectedEndpoint =
    workerOrigin.replace(/\/+$/g, "") + "/interactions";
  const currentEndpoint = String(
    application.interactions_endpoint_url ?? ""
  ).trim();

  if (currentEndpoint === expectedEndpoint) {
    return {
      applicationId,
      verifyKeyAvailable: /^[0-9a-f]{64}$/i.test(
        String(application.verify_key ?? "")
      ),
      endpoint: expectedEndpoint,
      changed: false
    };
  }

  const updated = await discordJson<CurrentApplication>(
    env,
    "/applications/@me",
    {
      method: "PATCH",
      body: JSON.stringify({
        interactions_endpoint_url: expectedEndpoint
      })
    }
  );

  return {
    applicationId: String(updated.id ?? applicationId),
    verifyKeyAvailable: /^[0-9a-f]{64}$/i.test(
      String(updated.verify_key ?? application.verify_key ?? "")
    ),
    endpoint: expectedEndpoint,
    changed: true
  };
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
