export type SearchCredentialEnv = {
  DB: D1Database;
  XUTILITY_BRIDGE_SECRET: string;
};

export type SearchCredential = {
  session: string;
  csrf: string;
  updatedAt: number;
};

const ddl =
  "CREATE TABLE IF NOT EXISTS search_credentials (" +
  "id INTEGER PRIMARY KEY CHECK (id = 1)," +
  "session_enc TEXT NOT NULL," +
  "csrf_enc TEXT NOT NULL," +
  "updated_at INTEGER NOT NULL)";

function b64url(bytes: Uint8Array): string {
  let raw = "";
  for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromB64url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const raw = atob(padded);
  return Uint8Array.from(raw, ch => ch.charCodeAt(0));
}

function asBuffer(value: Uint8Array): ArrayBuffer {
  const out = new Uint8Array(value.length);
  out.set(value);
  return out.buffer;
}

async function key(secret: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode("xutility-search-v1\n" + secret.trim())
  );
  return crypto.subtle.importKey(
    "raw",
    digest,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

async function seal(secret: string, value: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cryptoKey = await key(secret);
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: asBuffer(iv) },
      cryptoKey,
      new TextEncoder().encode(value)
    )
  );
  return b64url(iv) + "." + b64url(encrypted);
}

async function open(secret: string, value: string): Promise<string> {
  const [ivPart, dataPart] = value.split(".");
  if (!ivPart || !dataPart) throw new Error("SEARCH_CREDENTIAL_CORRUPTED");
  const iv = fromB64url(ivPart);
  const data = fromB64url(dataPart);
  const cryptoKey = await key(secret);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: asBuffer(iv) },
    cryptoKey,
    asBuffer(data)
  );
  return new TextDecoder().decode(plain);
}

async function ensureSchema(env: SearchCredentialEnv): Promise<void> {
  await env.DB.prepare(ddl).run();
}

export async function credentialStatus(
  env: SearchCredentialEnv
): Promise<{ configured: boolean; updatedAt: number | null }> {
  await ensureSchema(env);
  const row = await env.DB.prepare(
    "SELECT updated_at FROM search_credentials WHERE id=1"
  ).first<{updated_at:number}>();
  return {
    configured: Boolean(row),
    updatedAt: row ? Number(row.updated_at) : null
  };
}

export async function saveCredential(
  env: SearchCredentialEnv,
  input: { session: string; csrf: string }
): Promise<{ configured: true; updatedAt: number }> {
  const session = input.session.trim();
  const csrf = input.csrf.trim();
  if (!session || !csrf) throw new Error("SEARCH_CREDENTIAL_INCOMPLETE");

  await ensureSchema(env);
  const updatedAt = Date.now();
  const [sessionEnc, csrfEnc] = await Promise.all([
    seal(env.XUTILITY_BRIDGE_SECRET, session),
    seal(env.XUTILITY_BRIDGE_SECRET, csrf)
  ]);

  await env.DB.prepare(
    "INSERT INTO search_credentials(id,session_enc,csrf_enc,updated_at) " +
      "VALUES(1,?,?,?) " +
      "ON CONFLICT(id) DO UPDATE SET " +
      "session_enc=excluded.session_enc, " +
      "csrf_enc=excluded.csrf_enc, " +
      "updated_at=excluded.updated_at"
  ).bind(sessionEnc, csrfEnc, updatedAt).run();

  return { configured: true, updatedAt };
}

export async function loadCredential(
  env: SearchCredentialEnv
): Promise<SearchCredential | null> {
  await ensureSchema(env);
  const row = await env.DB.prepare(
    "SELECT session_enc,csrf_enc,updated_at FROM search_credentials WHERE id=1"
  ).first<{session_enc:string;csrf_enc:string;updated_at:number}>();
  if (!row) return null;

  const [session, csrf] = await Promise.all([
    open(env.XUTILITY_BRIDGE_SECRET, row.session_enc),
    open(env.XUTILITY_BRIDGE_SECRET, row.csrf_enc)
  ]);

  return {
    session,
    csrf,
    updatedAt: Number(row.updated_at)
  };
}

export async function clearCredential(env: SearchCredentialEnv): Promise<void> {
  await ensureSchema(env);
  await env.DB.prepare("DELETE FROM search_credentials WHERE id=1").run();
}
