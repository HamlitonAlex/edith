const encoder = new TextEncoder();
const decoder = new TextDecoder();

const bytesToBase64 = bytes => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const base64ToBytes = value => Uint8Array.from(atob(value), character => character.charCodeAt(0));

async function deriveKey(password, salt, cryptoImpl) {
  const material = await cryptoImpl.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);
  return cryptoImpl.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 210000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function createEncryptedBackup(payload, password, cryptoImpl = globalThis.crypto) {
  if (!password) throw new Error("请先设置备份密码");
  const salt = cryptoImpl.getRandomValues(new Uint8Array(16));
  const iv = cryptoImpl.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, cryptoImpl);
  const encrypted = await cryptoImpl.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(JSON.stringify(payload)));
  return JSON.stringify({ format: "xuecheng-local-backup", version: 1, kdf: "PBKDF2-SHA256", salt: bytesToBase64(salt), iv: bytesToBase64(iv), data: bytesToBase64(new Uint8Array(encrypted)) });
}

export async function readEncryptedBackup(serialized, password, cryptoImpl = globalThis.crypto) {
  try {
    const envelope = JSON.parse(serialized);
    if (envelope.format !== "xuecheng-local-backup" || envelope.version !== 1) throw new Error("invalid");
    const iv = base64ToBytes(envelope.iv);
    const key = await deriveKey(password, base64ToBytes(envelope.salt), cryptoImpl);
    const decrypted = await cryptoImpl.subtle.decrypt({ name: "AES-GCM", iv }, key, base64ToBytes(envelope.data));
    return JSON.parse(decoder.decode(decrypted));
  } catch {
    throw new Error("密码不正确或文件已损坏");
  }
}
