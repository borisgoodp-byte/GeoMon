/**
 * 认证工具（零新依赖）：node:crypto scrypt + 随机 salt。
 * passwordHash 存储格式：`salt:hex`（salt 与 scrypt 输出均为 hex 编码）。
 */

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const SCRYPT_KEYLEN = 64;

/** 生成密码哈希：`saltHex:hashHex` */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = await new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, SCRYPT_KEYLEN, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
  return `${salt}:${derived.toString("hex")}`;
}

/** 校验密码：与存储的 `salt:hex` 比对（timingSafeEqual 防时序攻击） */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [salt, hex] = stored.split(":");
  if (!salt || !hex) return false;
  const derived = await new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, SCRYPT_KEYLEN, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
  const expected = Buffer.from(hex, "hex");
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

/** 生成会话 token：32 字节随机数 hex（64 字符） */
export function generateToken(): string {
  return randomBytes(32).toString("hex");
}
