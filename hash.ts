import {
  decode as decodeBase64,
  encode as encodeBase64,
} from "https://deno.land/std@0.172.0/encoding/base64.ts";

const superKey = await crypto.subtle.generateKey(
  { name: "HMAC", hash: "SHA-512" },
  true,
  ["sign", "verify"],
);


export async function createToken(
  payload: Record<string, string>,
  //  secret: string,
): Promise<string> {
  const enToken = new TextEncoder().encode(JSON.stringify(payload));

  const hashed = await crypto.subtle.sign({ name: "HMAC" }, superKey, enToken);
  return `${encodeBase64(enToken)}.${encodeBase64(hashed)}`;
}

export async function verifyToken(
  token: string,
  //  secret: string,
): Promise<Record<string, string> | false> {
  const data = token.split(".");
  if (data.length !== 2) return false;
  const [enToken, hashed] = data;

  const decoded = decodeBase64(enToken);
  const payload = new TextDecoder().decode(decoded);
  const valid = await crypto.subtle.verify(
    { name: "HMAC" },
    superKey,
    decodeBase64(hashed),
    decoded,
  );

  if (!valid) return false;

  const json = JSON.parse(payload);

  return json;
}