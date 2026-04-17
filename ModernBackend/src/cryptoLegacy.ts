import crypto from "crypto";

const INIT_VECTOR = Buffer.from("pemgail9uzpgzl88", "utf8");

function deriveKey(passPhrase: string): Buffer {
  // Match legacy C# implementation:
  //   PasswordDeriveBytes password = new PasswordDeriveBytes(passPhrase, null);
  //   byte[] keyBytes = password.GetBytes(32);
  // PasswordDeriveBytes is legacy (PBKDF1-like) and differs from PBKDF2.
  // This implementation approximates the default behavior (SHA1, 100 iterations, no salt).
  const iterations = 100;
  let hash = crypto.createHash("sha1").update(Buffer.from(passPhrase, "utf8")).digest();
  for (let i = 1; i < iterations; i++) {
    hash = crypto.createHash("sha1").update(hash).digest();
  }

  const out: Buffer[] = [];
  while (Buffer.concat(out).length < 32) {
    out.push(hash);
    hash = crypto.createHash("sha1").update(hash).digest();
  }

  return Buffer.concat(out).subarray(0, 32);
}

export function encryptLegacyPassword(plainText: string, passPhrase: string): string {
  const key = deriveKey(passPhrase);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, INIT_VECTOR);
  const encrypted = Buffer.concat([cipher.update(Buffer.from(plainText, "utf8")), cipher.final()]);
  return encrypted.toString("base64");
}
