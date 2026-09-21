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

  async #read(userId) {
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

  async #write(userId, value) {
    const path = safeUserPath(this.#root, userId);
    const temporary = join(this.#root, `.${userId}.${crypto.randomUUID()}.tmp`);
    await writeFile(temporary, JSON.stringify(value, null, 2), { encoding: "utf8", mode: 0o600 });
    await rename(temporary, path);
  }

  async get(userId) {
    await this.#ensureRoot();
    return this.#read(userId);
  }

  async #queue(userId, operation) {
    const prior = this.#writes.get(userId) || Promise.resolve();
    const write = prior.then(async () => {
      await this.#ensureRoot();
      return operation();
    });
    this.#writes.set(userId, write.catch(() => {}));
    return write;
  }

  async put(userId, value) {
    return this.#queue(userId, () => this.#write(userId, value));
  }

  async update(userId, updater) {
    return this.#queue(userId, async () => {
      const next = await updater(await this.#read(userId));
      await this.#write(userId, next);
      return next;
    });
  }
}
