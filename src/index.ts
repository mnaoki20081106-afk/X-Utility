import {
  discordInteractionResponse,
  discordJson,
  editOriginalInteraction,
  ensureInteractionsEndpoint,
  verifyInteraction,
  type DiscordEnv
} from "./discord";
import { checkShadowban, type ShadowbanItem } from "./shadowban";
import { generateTotp } from "./totp";

type RateLimiterBinding = {
  limit(input: { key: string }): Promise<{ success: boolean }>;
};

type Env = DiscordEnv & {
  XUTILITY_BRIDGE_SECRET: string;
  SHADOWBAN_USER_LIMITER: RateLimiterBinding;
  SHADOWBAN_GLOBAL_LIMITER: RateLimiterBinding;
};

const SHADOWBAN_BUTTON_ID = "xutil:shadowban:open";
const SHADOWBAN_MODAL_ID = "xutil:shadowban:submit";
const SHADOWBAN_USERNAME_ID = "username";
const TOTP_BUTTON_ID = "xutil:2fa:open";
const TOTP_MODAL_ID = "xutil:2fa:submit";
const TOTP_SECRET_ID = "secret";
const TOTP_REFRESH_PREFIX = "xutil:2fa:r:";
const TOTP_NEW_KEY_ID = "xutil:2fa:new";
const MAX_CLOCK_SKEW_MS = 5 * 60_000;
const replayNonces = new Map<string, number>();

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function shadowbanPanelPayload() {
  return {
    embeds: [
      {
        title: "X シャドウバンチェック",
        description: "Xの垢のIDを入力してください",
        color: 0x111111
      }
    ],
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 1,
            label: "チェックする",
            custom_id: SHADOWBAN_BUTTON_ID
          }
        ]
      }
    ],
    allowed_mentions: { parse: [] }
  };
}

function totpPanelPayload() {
  return {
    embeds: [
      {
        title: "Twitter / X 2FAコード生成パネル",
        description:
          "ボタンを押して2FAキーを入力すると、あなたにだけ2FAコードが表示されます。",
        color: 0x5865f2
      }
    ],
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 1,
            label: "🔐 2FAコードを生成",
            custom_id: TOTP_BUTTON_ID
          }
        ]
      }
    ],
    allowed_mentions: { parse: [] }
  };
}

function modalValue(interaction: any, customId: string): string {
  const rows = Array.isArray(interaction?.data?.components)
    ? interaction.data.components
    : [];
  for (const row of rows) {
    const components = Array.isArray(row?.components) ? row.components : [];
    for (const component of components) {
      if (component?.custom_id === customId) {
        return String(component?.value ?? "").trim();
      }
    }
  }
  return "";
}

function shadowbanModal() {
  return {
    type: 9,
    data: {
      custom_id: SHADOWBAN_MODAL_ID,
      title: "X シャドウバンチェック",
      components: [
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: SHADOWBAN_USERNAME_ID,
              label: "Xの垢のID",
              style: 1,
              min_length: 1,
              max_length: 16,
              required: true,
              placeholder: "@付きでも無しでもOK"
            }
          ]
        }
      ]
    }
  };
}


function totpModal() {
  return {
    type: 9,
    data: {
      custom_id: TOTP_MODAL_ID,
      title: "Twitter / X 2FAコード",
      components: [
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: TOTP_SECRET_ID,
              label: "2FAキー",
              style: 1,
              min_length: 8,
              max_length: 36,
              required: true,
              placeholder: "例: ABCD EFGH IJKL MNOP（16桁）"
            }
          ]
        }
      ]
    }
  };
}

function toBase64Url(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function totpStateKey(secret: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode("x-utility:totp-state:" + secret)
  );
  return crypto.subtle.importKey(
    "raw",
    digest,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

async function sealTotpSecret(secret: string, env: Env): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await totpStateKey(env.XUTILITY_BRIDGE_SECRET);
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(secret.trim())
    )
  );
  const packed = new Uint8Array(iv.length + encrypted.length);
  packed.set(iv, 0);
  packed.set(encrypted, iv.length);
  const token = toBase64Url(packed);
  if ((TOTP_REFRESH_PREFIX + token).length > 100) {
    throw new Error("2FAキーが長すぎます");
  }
  return token;
}

async function openTotpSecret(token: string, env: Env): Promise<string> {
  const packed = fromBase64Url(token);
  if (packed.length < 29) throw new Error("更新データが不正です");
  const iv = packed.slice(0, 12);
  const ciphertext = packed.slice(12);
  const key = await totpStateKey(env.XUTILITY_BRIDGE_SECRET);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(plain);
}

async function totpResultPayload(
  secret: string,
  env: Env
): Promise<Record<string, unknown>> {
  const result = await generateTotp(secret);
  const state = await sealTotpSecret(secret, env);
  return {
    flags: 64,
    embeds: [
      {
        title: "Twitter / X 2FAコード",
        description:
          "**`" +
          result.code +
          "`**\n\n" +
          "残り **" +
          result.remainingSeconds +
          "秒** くらいで更新されます。\n\n" +
          "**このコードはあなたにだけ表示されています。**",
        color: 0x2b2d31
      }
    ],
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 3,
            label: "🔄 更新",
            custom_id: TOTP_REFRESH_PREFIX + state
          },
          {
            type: 2,
            style: 2,
            label: "✏️ 別のキーを入力",
            custom_id: TOTP_NEW_KEY_ID
          }
        ]
      }
    ],
    allowed_mentions: { parse: [] }
  };
}

function stateLabel(item: ShadowbanItem): string {
  if (item.state === "clear") return "✅ 検出なし";
  if (item.state === "banned") return "❌ 制限を検出";
  if (item.state === "na") return "➖ 対象なし";
  return "⚠️ 判定不能";
}

function checkField(name: string, item: ShadowbanItem) {
  return {
    name,
    value: stateLabel(item) + "\n" + item.detail,
    inline: false
  };
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Xの確認処理が時間内に完了しませんでした")),
          timeoutMs
        );
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function finishShadowban(
  interaction: any,
  username: string,
  actorId: string,
  env: Env
): Promise<void> {
  try {
    const userLimit = await env.SHADOWBAN_USER_LIMITER.limit({
      key: actorId
    });
    if (!userLimit.success) {
      await editOriginalInteraction(interaction, {
        content: "チェック回数が多すぎます。1分あたり2回まで利用できます。",
        embeds: [],
        components: []
      });
      return;
    }

    const globalLimit = await env.SHADOWBAN_GLOBAL_LIMITER.limit({
      key: "shadowban-check"
    });
    if (!globalLimit.success) {
      await editOriginalInteraction(interaction, {
        content:
          "現在チェックが集中しています。少し時間を空けてから再実行してください。",
        embeds: [],
        components: []
      });
      return;
    }

    const result = await withTimeout(
      checkShadowban(username),
      14_000
    );
    const checks = result.checks;
    const title =
      result.displayName && result.displayName !== result.username
        ? result.displayName + " (@" + result.username + ")"
        : "@" + result.username;

    await editOriginalInteraction(interaction, {
      content: "",
      embeds: [
        {
          title: "X シャドウバンチェック — " + title,
          description:
            "X上の公開表示を観測した結果です。仕様変更や検索側の一時制限により、" +
            "結果が変動する場合があります。",
          color: Object.values(checks).some((item) => item.state === "banned")
            ? 0xe74c3c
            : Object.values(checks).some((item) => item.state === "unknown")
              ? 0xf1c40f
              : 0x2ecc71,
          fields: [
            checkField("Media Ban", checks.mediaBan),
            checkField("Search Sensitive Ban", checks.searchSensitiveBan),
            checkField("Search Suggestion Ban", checks.searchSuggestionBan),
            checkField("Search Ban", checks.searchBan),
            checkField("Ghost Ban", checks.ghostBan),
            checkField("Reply Deboosting", checks.replyDeboosting)
          ],
          footer: { text: "X-Utility" },
          timestamp: result.checkedAt
        }
      ],
      components: []
    });
  } catch (error) {
    await editOriginalInteraction(interaction, {
      content:
        "チェックに失敗しました: " +
        (error instanceof Error ? error.message : String(error)),
      embeds: [],
      components: []
    });
  }
}

async function finishTotp(
  interaction: any,
  secret: string,
  env: Env
): Promise<void> {
  try {
    const payload = await totpResultPayload(secret, env);
    delete payload.flags;
    await editOriginalInteraction(interaction, payload);
  } catch (error) {
    await editOriginalInteraction(interaction, {
      content:
        "2FAコードを生成できませんでした: " +
        (error instanceof Error ? error.message : String(error)),
      embeds: [],
      components: []
    });
  }
}

async function handleInteraction(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const body = await request.text();
  if (!(await verifyInteraction(env, request, body))) {
    return new Response("invalid request signature", { status: 401 });
  }

  let interaction: any;
  try {
    interaction = JSON.parse(body);
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  if (interaction.type === 1) {
    return discordInteractionResponse({ type: 1 });
  }

  if (interaction.type === 3) {
    const customId = String(interaction?.data?.custom_id ?? "");
    if (customId === SHADOWBAN_BUTTON_ID) {
      return discordInteractionResponse(shadowbanModal());
    }
    if (customId === TOTP_BUTTON_ID || customId === TOTP_NEW_KEY_ID) {
      return discordInteractionResponse(totpModal());
    }
    if (customId.startsWith(TOTP_REFRESH_PREFIX)) {
      try {
        const token = customId.slice(TOTP_REFRESH_PREFIX.length);
        const secret = await openTotpSecret(token, env);
        const data = await totpResultPayload(secret, env);
        delete data.flags;
        return discordInteractionResponse({
          type: 7,
          data
        });
      } catch (error) {
        return discordInteractionResponse({
          type: 4,
          data: {
            flags: 64,
            content:
              "2FAコードを更新できませんでした: " +
              (error instanceof Error ? error.message : String(error))
          }
        });
      }
    }
  }

  if (interaction.type === 5) {
    const customId = String(interaction?.data?.custom_id ?? "");

    if (customId === TOTP_MODAL_ID) {
      const secret = modalValue(interaction, TOTP_SECRET_ID);
      try {
        return discordInteractionResponse({
          type: 4,
          data: await totpResultPayload(secret, env)
        });
      } catch (error) {
        return discordInteractionResponse({
          type: 4,
          data: {
            flags: 64,
            content:
              "2FAコードを生成できませんでした: " +
              (error instanceof Error ? error.message : String(error))
          }
        });
      }
    }

    if (customId === SHADOWBAN_MODAL_ID) {
      const username = modalValue(interaction, SHADOWBAN_USERNAME_ID);
      if (!username) {
        return discordInteractionResponse({
          type: 4,
          data: {
            flags: 64,
            content: "Xの垢のIDを入力してください"
          }
        });
      }

      const actorId = String(
        interaction?.member?.user?.id ?? interaction?.user?.id ?? ""
      );
      if (!actorId) {
        return discordInteractionResponse({
          type: 4,
          data: {
            flags: 64,
            content: "操作ユーザーを確認できませんでした"
          }
        });
      }

      if (!/^@?[A-Za-z0-9_]{1,15}$/.test(username)) {
        return discordInteractionResponse({
          type: 4,
          data: {
            flags: 64,
            content: "有効なXの垢のIDを入力してください"
          }
        });
      }

      ctx.waitUntil(
        finishShadowban(interaction, username, actorId, env)
      );
      return discordInteractionResponse({
        type: 4,
        data: {
          flags: 64,
          content: "シャドウバンを確認しています..."
        }
      });
    }


  }

  return discordInteractionResponse({
    type: 4,
    data: {
      flags: 64,
      content: "この操作は現在のX-Utilityでは処理できません"
    }
  });
}

function hexToBytes(value: string): Uint8Array | null {
  if (!/^[0-9a-f]{64}$/i.test(value)) return null;
  const out = new Uint8Array(value.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function pruneNonces(now: number): void {
  for (const [nonce, expiresAt] of replayNonces) {
    if (expiresAt <= now) replayNonces.delete(nonce);
  }
}

async function verifyBridgeRequest(
  request: Request,
  env: Env,
  url: URL,
  body: string
): Promise<void> {
  const secret = env.XUTILITY_BRIDGE_SECRET?.trim() ?? "";
  if (secret.length < 32) {
    throw new Error("XUTILITY_BRIDGE_SECRET_NOT_CONFIGURED");
  }

  const timestamp = request.headers.get("X-XUtility-Timestamp")?.trim() ?? "";
  const nonce = request.headers.get("X-XUtility-Nonce")?.trim() ?? "";
  const signature = request.headers.get("X-XUtility-Signature")?.trim() ?? "";
  const ts = Number(timestamp);

  if (!/^\d{10,16}$/.test(timestamp) || !Number.isFinite(ts)) {
    throw new Error("INVALID_TIMESTAMP");
  }
  if (Math.abs(Date.now() - ts) > MAX_CLOCK_SKEW_MS) {
    throw new Error("STALE_TIMESTAMP");
  }
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(nonce)) {
    throw new Error("INVALID_NONCE");
  }
  const signatureBytes = hexToBytes(signature);
  if (!signatureBytes) throw new Error("INVALID_SIGNATURE");

  const canonical =
    timestamp +
    "\n" +
    nonce +
    "\n" +
    request.method.toUpperCase() +
    "\n" +
    url.pathname +
    url.search +
    "\n" +
    body;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    signatureBytes.buffer as ArrayBuffer,
    new TextEncoder().encode(canonical)
  );
  if (!valid) throw new Error("INVALID_SIGNATURE");

  const now = Date.now();
  pruneNonces(now);
  if (replayNonces.has(nonce)) throw new Error("REPLAYED_NONCE");
  replayNonces.set(nonce, now + MAX_CLOCK_SKEW_MS);
}

function bridgeError(error: unknown): Response {
  const code = error instanceof Error ? error.message : String(error);
  const authErrors = new Set([
    "INVALID_TIMESTAMP",
    "STALE_TIMESTAMP",
    "INVALID_NONCE",
    "INVALID_SIGNATURE",
    "REPLAYED_NONCE"
  ]);
  const status =
    code === "XUTILITY_BRIDGE_SECRET_NOT_CONFIGURED"
      ? 503
      : authErrors.has(code)
        ? 401
        : code.startsWith("Discord API 403")
          ? 403
          : code.startsWith("Discord API 404")
            ? 404
            : 400;
  return json({ error: code }, status);
}

async function handleBridge(
  request: Request,
  env: Env,
  url: URL
): Promise<Response | null> {
  const match = url.pathname.match(
    /^\/bridge\/main\/guilds\/(\d+)\/panels\/(shadowban|2fa)$/
  );
  if (!match) return null;
  if (request.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const body = await request.text();
  try {
    await verifyBridgeRequest(request, env, url, body);
    let input: { channelId?: string };
    try {
      input = JSON.parse(body) as { channelId?: string };
    } catch {
      return json({ error: "INVALID_JSON" }, 400);
    }

    const guildId = match[1]!;
    const kind = match[2] as "shadowban" | "2fa";

    await ensureInteractionsEndpoint(env, url.origin);

    const channelId = String(input.channelId ?? "").trim();
    if (!/^\d{17,20}$/.test(channelId)) {
      return json({ error: "INVALID_CHANNEL_ID" }, 400);
    }

    const channel = await discordJson<{
      id: string;
      guild_id?: string;
      type?: number;
    }>(env, "/channels/" + channelId);
    if (channel.guild_id !== guildId) {
      return json({ error: "CHANNEL_GUILD_MISMATCH" }, 400);
    }
    if (channel.type !== 0 && channel.type !== 5) {
      return json({ error: "CHANNEL_NOT_MESSAGE_CHANNEL" }, 400);
    }

    const message = await discordJson<{ id: string }>(
      env,
      "/channels/" + channelId + "/messages",
      {
        method: "POST",
        body: JSON.stringify(
          kind === "shadowban"
            ? shadowbanPanelPayload()
            : totpPanelPayload()
        )
      }
    );
    return json({
      ok: true,
      guildId,
      channelId,
      kind,
      messageId: message.id
    });
  } catch (error) {
    return bridgeError(error);
  }
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "/health") {
      let bot: { id: string; username: string } | null = null;
      let interactionConfig:
        | {
            applicationId: string;
            verifyKeyAvailable: boolean;
            endpoint: string;
            changed: boolean;
          }
        | null = null;
      let discordError: string | null = null;

      try {
        [bot, interactionConfig] = await Promise.all([
          discordJson<{ id: string; username: string }>(env, "/users/@me"),
          ensureInteractionsEndpoint(env, url.origin)
        ]);
      } catch (error) {
        discordError = error instanceof Error ? error.message : String(error);
      }

      const applicationMatchesToken =
        Boolean(bot) &&
        bot?.id === env.DISCORD_APPLICATION_ID?.trim();
      const bridgeConfigured =
        (env.XUTILITY_BRIDGE_SECRET?.trim().length ?? 0) >= 32;
      const interactionsReady =
        Boolean(interactionConfig?.verifyKeyAvailable) &&
        interactionConfig?.endpoint ===
          url.origin.replace(/\/+$/g, "") + "/interactions";
      const ok =
        applicationMatchesToken &&
        bridgeConfigured &&
        interactionsReady &&
        !discordError;

      return json(
        {
          ok,
          runtime: "cloudflare-workers",
          botId: bot?.id ?? null,
          botUsername: bot?.username ?? null,
          applicationMatchesToken,
          bridgeConfigured,
          interactionsReady,
          interactionsEndpoint: interactionConfig?.endpoint ?? null,
          endpointWasRepaired: interactionConfig?.changed ?? false,
          configuredPublicKeyPresent:
            /^[0-9a-fA-F]{64}$/.test(env.DISCORD_PUBLIC_KEY?.trim() ?? ""),
          publicKeyResolution: "automatic-from-discord-application",
          discordError
        },
        ok ? 200 : 503
      );
    }

    if (url.pathname === "/interactions" && request.method === "POST") {
      try {
        return await handleInteraction(request, env, ctx);
      } catch (error) {
        console.error(
          "interaction handler failed:",
          error instanceof Error ? error.message : String(error)
        );
        return discordInteractionResponse(
          {
            type: 4,
            data: {
              flags: 64,
              content:
                "X-Utility側でエラーが発生しました。BOTを再デプロイして設定を確認してください。"
            }
          },
          200
        );
      }
    }

    const bridge = await handleBridge(request, env, url);
    if (bridge) return bridge;

    return json({ error: "NOT_FOUND" }, 404);
  }
};
