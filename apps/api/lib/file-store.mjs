import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { ApiError } from "./http.mjs";

function safeUserPath(root, userId) {
  const path = resolve(root, `${userId}.json`);
  const prefix = `${resolve(root)}${process.platform === "win32" ? "\\" : "/"}`;
  if (!path.startsWith(prefix)) throw new ApiError(400, "invalid_user", "用户标识无效。");
  return path;
}

export class FileStore {
  #root;
  #writes = new Map();

  constructor(root) {
    this.#root = resolve(root);
  }

  async #ensureRoot() {
    await mkdir(this.#root, { recursive: true });
  }

  async get(userId) {
    await this.#ensureRoot();
    const path = safeUserPath(this.#root, userId);
    try {
      return JSON.parse(await readFile(path, "utf8"));
    } catch (cause) {
      if (cause?.code === "ENOENT") return null;
      if (cause instanceof SyntaxError) {
        throw new ApiError(500, "stored_data_invalid", "本地服务数据无法读取，请联系服务维护者。");
      }
      throw cause;
    }
  }

  async put(userId, value) {
    const prior = this.#writes.get(userId) || Promise.resolve();
    const write = prior.then(async () => {
      await this.#ensureRoot();
      const path = safeUserPath(this.#root, userId);
      const temporary = join(this.#root, `.${userId}.${crypto.randomUUID()}.tmp`);
      await writeFile(temporary, JSON.stringify(value, null, 2), { encoding: "utf8", mode: 0o600 });
      await rename(temporary, path);
    });
    this.#writes.set(userId, write.catch(() => {}));
    return write;
  }
}
