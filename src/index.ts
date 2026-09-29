import {
  discordInteractionResponse,
  discordJson,
  editOriginalInteraction,
  verifyInteraction,
  type DiscordEnv
} from "./discord";
import { checkShadowban, type ShadowbanItem } from "./shadowban";

type RateLimiterBinding = {
  limit(input: { key: string }): Promise<{ success: boolean }>;
};

type Env = DiscordEnv & {
  XUTILITY_BRIDGE_SECRET: string;
  X_AUTH_TOKEN: string;
  SHADOWBAN_USER_LIMITER: RateLimiterBinding;
  SHADOWBAN_GLOBAL_LIMITER: RateLimiterBinding;
};

const SHADOWBAN_BUTTON_ID = "xutil:shadowban:open";
const SHADOWBAN_MODAL_ID = "xutil:shadowban:submit";
const SHADOWBAN_USERNAME_ID = "username";
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

function totpPanelPayload(origin: string) {
  return {
    embeds: [
      {
        title: "X 2FAコード生成",
        description:
          "認証アプリ用Base32シークレットから6桁TOTPを生成します。\n" +
          "シークレットはDiscordやX-Utilityへ送信せず、開いた端末内だけで計算します。",
        color: 0x111111
      }
    ],
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 5,
            label: "2FAコードを生成",
            url: origin + "/totp"
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
  env: Env
): Promise<void> {
  try {
    const result = await withTimeout(
      checkShadowban(username, { authToken: env.X_AUTH_TOKEN }),
      24_000
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
            content: "有効なXユーザー名を入力してください"
          }
        });
      }

      const userLimit = await env.SHADOWBAN_USER_LIMITER.limit({
        key: actorId
      });
      if (!userLimit.success) {
        return discordInteractionResponse({
          type: 4,
          data: {
            flags: 64,
            content:
              "チェック回数が多すぎます。1分あたり2回まで利用できます。"
          }
        });
      }

      const globalLimit = await env.SHADOWBAN_GLOBAL_LIMITER.limit({
        key: "shadowban-check"
      });
      if (!globalLimit.success) {
        return discordInteractionResponse({
          type: 4,
          data: {
            flags: 64,
            content:
              "現在チェックが集中しています。少し時間を空けてから再実行してください。"
          }
        });
      }

      ctx.waitUntil(finishShadowban(interaction, username, env));
      return discordInteractionResponse({
        type: 5,
        data: { flags: 64 }
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
            : totpPanelPayload(url.origin)
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

function totpPage(): Response {
  const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>X-Utility 2FA</title>
<style>
:root{color-scheme:dark;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0d10;color:#f5f7fa;padding:20px}
main{width:min(520px,100%);background:#14181d;border:1px solid #2a3038;border-radius:18px;padding:24px;box-shadow:0 18px 60px #0008}
h1{font-size:22px;margin:0 0 8px}p{color:#aeb7c2;line-height:1.6}label{display:block;font-weight:700;margin:20px 0 8px}
input{width:100%;padding:14px;border:1px solid #39424d;border-radius:12px;background:#0e1115;color:#fff;font:inherit}
button{margin-top:12px;width:100%;padding:13px;border:0;border-radius:12px;background:#f4f6f8;color:#0b0d10;font-weight:800;font:inherit;cursor:pointer}
.code{font:700 42px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.14em;text-align:center;margin:24px 0 6px}
.small{text-align:center;color:#98a3af;font-size:13px}.ok{color:#77d99a}.err{color:#ff8d8d}
</style>
</head>
<body>
<main>
<h1>X 2FAコード生成</h1>
<p>入力したシークレットはこの端末内のJavaScriptだけで処理され、X-UtilityやDiscordへ送信されません。ページを閉じると消えます。</p>
<label for="secret">Base32シークレット</label>
<input id="secret" type="password" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="JBSWY3DPEHPK3PXP">
<button id="generate" type="button">コードを生成</button>
<div id="code" class="code">------</div>
<div id="status" class="small">シークレットを入力してください</div>
</main>
<script>
(() => {
  "use strict";
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const input = document.getElementById("secret");
  const codeEl = document.getElementById("code");
  const statusEl = document.getElementById("status");
  let activeSecret = "";

  function decodeBase32(raw) {
    const value = raw.trim().toUpperCase().replace(/[\\s-]+/g, "").replace(/=+$/g, "");
    if (!value || !/^[A-Z2-7]+$/.test(value)) throw new Error("Base32形式で入力してください");
    let buffer = 0, bits = 0;
    const bytes = [];
    for (const ch of value) {
      buffer = (buffer << 5) | alphabet.indexOf(ch);
      bits += 5;
      while (bits >= 8) {
        bits -= 8;
        bytes.push((buffer >>> bits) & 255);
        buffer &= (1 << bits) - 1;
      }
    }
    if (!bytes.length) throw new Error("シークレットが短すぎます");
    return new Uint8Array(bytes);
  }

  function counterBytes(counter) {
    const out = new Uint8Array(8);
    let value = BigInt(counter);
    for (let i = 7; i >= 0; i--) {
      out[i] = Number(value & 255n);
      value >>= 8n;
    }
    return out;
  }

  async function totp(secret) {
    const epoch = Math.floor(Date.now() / 1000);
    const counter = Math.floor(epoch / 30);
    const key = await crypto.subtle.importKey(
      "raw", decodeBase32(secret), {name:"HMAC",hash:"SHA-1"}, false, ["sign"]
    );
    const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, counterBytes(counter)));
    const offset = digest[digest.length - 1] & 15;
    const binary =
      ((digest[offset] & 127) << 24) |
      ((digest[offset + 1] & 255) << 16) |
      ((digest[offset + 2] & 255) << 8) |
      (digest[offset + 3] & 255);
    return {
      code: String(binary % 1000000).padStart(6, "0"),
      remaining: 30 - (epoch % 30)
    };
  }

  async function render() {
    if (!activeSecret) return;
    try {
      const result = await totp(activeSecret);
      codeEl.textContent = result.code;
      statusEl.textContent = "あと " + result.remaining + " 秒";
      statusEl.className = "small ok";
    } catch (error) {
      codeEl.textContent = "------";
      statusEl.textContent = error instanceof Error ? error.message : String(error);
      statusEl.className = "small err";
      activeSecret = "";
    }
  }

  document.getElementById("generate").addEventListener("click", () => {
    activeSecret = input.value;
    render();
  });
  setInterval(render, 1000);
  window.addEventListener("pagehide", () => {
    activeSecret = "";
    input.value = "";
    codeEl.textContent = "------";
  });
})();
</script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy":
        "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; font-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY"
    }
  });
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/totp" && request.method === "GET") {
      return totpPage();
    }

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
            (env.XUTILITY_BRIDGE_SECRET?.trim().length ?? 0) >= 32 &&
            (env.X_AUTH_TOKEN?.trim().length ?? 0) >= 20,
          runtime: "cloudflare-workers",
          botId: bot?.id ?? null,
          botUsername: bot?.username ?? null,
          applicationMatchesToken:
            Boolean(bot) && bot?.id === env.DISCORD_APPLICATION_ID?.trim(),
          bridgeConfigured:
            (env.XUTILITY_BRIDGE_SECRET?.trim().length ?? 0) >= 32,
          checkerAuthConfigured:
            (env.X_AUTH_TOKEN?.trim().length ?? 0) >= 20,
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
