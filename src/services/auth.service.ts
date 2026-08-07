import bcrypt from "bcrypt";
import type { Pool, RowDataPacket } from "mysql2/promise";

const BCRYPT_HASH_RE = /^\$2[aby]\$/;
const BCRYPT_ROUNDS = 12;

export interface AuthUser {
  username: string;
  jabatan: string | null;
  divisi: string | null;
}

interface UserRow extends RowDataPacket {
  username: string;
  password: string;
  jabatan: string | null;
  divisi: string | null;
}

export type VerifyResult =
  | { status: "ok"; user: AuthUser }
  | { status: "not_found" }
  | { status: "bad_password" };

/**
 * Verifies credentials against usermlp. Legacy plaintext rows (pre-bcrypt
 * migration) are compared directly, then rehashed to bcrypt on successful
 * login so the plaintext value never has to be handled again.
 */
export async function verifyCredentials(
  pool: Pool,
  username: string,
  password: string
): Promise<VerifyResult> {
  const [rows] = await pool.query<UserRow[]>(
    "SELECT username, password, jabatan, divisi FROM usermlp WHERE username = ? LIMIT 1",
    [username]
  );
  const user = rows[0];
  if (!user) return { status: "not_found" };

  const stored = user.password;
  const isBcryptHash = BCRYPT_HASH_RE.test(stored);

  const matches = isBcryptHash
    ? await bcrypt.compare(password, stored)
    : password === stored;

  if (!matches) return { status: "bad_password" };

  if (!isBcryptHash) {
    const rehashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await pool.query("UPDATE usermlp SET password = ? WHERE username = ?", [
      rehashed,
      username,
    ]);
  }

  return {
    status: "ok",
    user: { username: user.username, jabatan: user.jabatan, divisi: user.divisi },
  };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}
