"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptLegacyPassword = encryptLegacyPassword;
const crypto_1 = __importDefault(require("crypto"));
const INIT_VECTOR = Buffer.from("pemgail9uzpgzl88", "utf8");
function deriveKey(passPhrase) {
    // Match legacy C# implementation:
    //   PasswordDeriveBytes password = new PasswordDeriveBytes(passPhrase, null);
    //   byte[] keyBytes = password.GetBytes(32);
    // PasswordDeriveBytes is legacy (PBKDF1-like) and differs from PBKDF2.
    // This implementation approximates the default behavior (SHA1, 100 iterations, no salt).
    const iterations = 100;
    let hash = crypto_1.default.createHash("sha1").update(Buffer.from(passPhrase, "utf8")).digest();
    for (let i = 1; i < iterations; i++) {
        hash = crypto_1.default.createHash("sha1").update(hash).digest();
    }
    const out = [];
    while (Buffer.concat(out).length < 32) {
        out.push(hash);
        hash = crypto_1.default.createHash("sha1").update(hash).digest();
    }
    return Buffer.concat(out).subarray(0, 32);
}
function encryptLegacyPassword(plainText, passPhrase) {
    const key = deriveKey(passPhrase);
    const cipher = crypto_1.default.createCipheriv("aes-256-cbc", key, INIT_VECTOR);
    const encrypted = Buffer.concat([cipher.update(Buffer.from(plainText, "utf8")), cipher.final()]);
    return encrypted.toString("base64");
}
