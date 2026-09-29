import {
  discordInteractionResponse,
  discordJson,
  editOriginalInteraction,
  verifyInteraction,
  type DiscordEnv
} from "./discord";
import { checkShadowban, type ShadowbanItem } from "./shadowban";
import { generateTotp } from "./totp";

type Env = DiscordEnv & {
  XUTILITY_BRIDGE_SECRET: string;
};

const SHADOWBAN_BUTTON_ID = "xutil:shadowban:open";
const SHADOWBAN_MODAL_ID = "xutil:shadowban:submit";
const SHADOWBAN_USERNAME_ID = "username";
const TOTP_BUTTON_ID = "xutil:2fa:open";
const TOTP_MODAL_ID = "xutil:2fa:submit";
const TOTP_SECRET_ID = "secret";
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
        description:
          "Xの検索・検索候補・返信表示を確認して、6項目の状態をチェックします。\n" +
          "取得できない項目は推測せず「判定不能」と表示します。",
        color: 0x111111,
        fields: [
          {
            name: "チェック項目",
            value:
              "Media Ban / Search Sensitive Ban / Search Suggestion Ban / " +
              "Search Ban / Ghost Ban / Reply Deboosting"
          }
        ]
      }
    ],
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 1,
            label: "シャドウバンをチェック",
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
        title: "X 2FAコード生成",
        description:
          "Xの認証アプリ用Base32シークレットから、現在の6桁TOTPコードを生成します。\n" +
          "入力したシークレットは保存しません。結果は本人にだけ表示されます。",
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
            label: "2FAコードを生成",
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
              label: "Xユーザー名",
              style: 1,
              min_length: 1,
              max_length: 16,
              required: true,
              placeholder: "@username"
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
      title: "X 2FAコード生成",
      components: [
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: TOTP_SECRET_ID,
              label: "2FAシークレット（Base32）",
              style: 1,
              min_length: 8,
              max_length: 256,
              required: true,
              placeholder: "例: JBSWY3DPEHPK3PXP"
            }
          ]
        }
      ]
    }
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

async function finishShadowban(interaction: any, username: string): Promise<void> {
  try {
    const result = await checkShadowban(username);
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
    if (customId === TOTP_BUTTON_ID) {
      return discordInteractionResponse(totpModal());
    }
  }

  if (interaction.type === 5) {
    const customId = String(interaction?.data?.custom_id ?? "");

    if (customId === SHADOWBAN_MODAL_ID) {
      const username = modalValue(interaction, SHADOWBAN_USERNAME_ID);
      if (!username) {
        return discordInteractionResponse({
          type: 4,
          data: {
            flags: 64,
            content: "Xユーザー名を入力してください"
          }
        });
      }
      ctx.waitUntil(finishShadowban(interaction, username));
      return discordInteractionResponse({
        type: 5,
        data: { flags: 64 }
      });
    }

    if (customId === TOTP_MODAL_ID) {
      const secret = modalValue(interaction, TOTP_SECRET_ID);
      try {
        const result = await generateTotp(secret);
        return discordInteractionResponse({
          type: 4,
          data: {
            flags: 64,
            embeds: [
              {
                title: "X 2FAコード",
                description: "**`" + result.code + "`**",
                color: 0x2ecc71,
                fields: [
                  {
                    name: "有効時間",
                    value:
                      "あと約 " +
                      result.remainingSeconds +
                      " 秒（30秒ごとに更新）"
                  }
                ],
                footer: {
                  text: "入力したシークレットはX-Utilityに保存されません"
                }
              }
            ]
          }
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
          kind === "shadowban" ? shadowbanPanelPayload() : totpPanelPayload()
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
      let discordError: string | null = null;
      try {
        bot = await discordJson(env, "/users/@me");
      } catch (error) {
        discordError = error instanceof Error ? error.message : String(error);
      }
      return json(
        {
          ok:
            Boolean(bot) &&
            bot?.id === env.DISCORD_APPLICATION_ID?.trim() &&
            (env.XUTILITY_BRIDGE_SECRET?.trim().length ?? 0) >= 32,
          runtime: "cloudflare-workers",
          botId: bot?.id ?? null,
          botUsername: bot?.username ?? null,
          applicationMatchesToken:
            Boolean(bot) && bot?.id === env.DISCORD_APPLICATION_ID?.trim(),
          bridgeConfigured:
            (env.XUTILITY_BRIDGE_SECRET?.trim().length ?? 0) >= 32,
          discordError
        },
        bot ? 200 : 503
      );
    }

    if (url.pathname === "/interactions" && request.method === "POST") {
      return handleInteraction(request, env, ctx);
    }

    const bridge = await handleBridge(request, env, url);
    if (bridge) return bridge;

    return json({ error: "NOT_FOUND" }, 404);
  }
};
