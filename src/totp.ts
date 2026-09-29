const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function normalizeBase32(value: string): string {
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "")
    .replace(/=+$/g, "");
  if (!normalized || !/^[A-Z2-7]+$/.test(normalized)) {
    throw new Error("2FAシークレットはBase32形式で入力してください");
  }
  return normalized;
}

export function decodeBase32(value: string): Uint8Array {
  const input = normalizeBase32(value);
  let buffer = 0;
  let bits = 0;
  const bytes: number[] = [];

  for (const char of input) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) throw new Error("Base32に使用できない文字が含まれています");
    buffer = (buffer << 5) | index;
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >>> bits) & 0xff);
      buffer &= (1 << bits) - 1;
    }
  }

  if (bytes.length === 0) {
    throw new Error("2FAシークレットが短すぎます");
  }
  return new Uint8Array(bytes);
}

function asArrayBuffer(value: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy.buffer;
}

function counterBytes(counter: number): Uint8Array {
  const out = new Uint8Array(8);
  let value = BigInt(counter);
  for (let i = 7; i >= 0; i--) {
    out[i] = Number(value & 0xffn);
    value >>= 8n;
  }
  return out;
}

export type TotpResult = {
  code: string;
  remainingSeconds: number;
  validFrom: number;
  validUntil: number;
};

export async function generateTotp(
  secret: string,
  nowMs = Date.now()
): Promise<TotpResult> {
  const keyBytes = decodeBase32(secret);
  const periodSeconds = 30;
  const epochSeconds = Math.floor(nowMs / 1000);
  const counter = Math.floor(epochSeconds / periodSeconds);
  const key = await crypto.subtle.importKey(
    "raw",
    asArrayBuffer(keyBytes),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const digest = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, asArrayBuffer(counterBytes(counter)))
  );
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);
  const code = String(binary % 1_000_000).padStart(6, "0");
  const validFromSeconds = counter * periodSeconds;
  const validUntilSeconds = validFromSeconds + periodSeconds;
  return {
    code,
    remainingSeconds: Math.max(1, validUntilSeconds - epochSeconds),
    validFrom: validFromSeconds * 1000,
    validUntil: validUntilSeconds * 1000
  };
}
