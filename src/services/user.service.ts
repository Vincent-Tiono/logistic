import type { Pool, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { hashPassword } from "./auth.service.js";

export const PROTECTED_USERS = ["admin"];

export interface UserRow {
  username: string;
  password: string;
  jabatan: string | null;
  divisi: string | null;
  created_at: string | null;
}

export type ActionResult =
  | { ok: true; msg: string }
  | { ok: false; msg: string };

export async function listUsers(
  pool: Pool,
  keyword: string
): Promise<UserRow[]> {
  const kw = keyword.trim();
  let sql =
    "SELECT username, password, jabatan, divisi, created_at FROM usermlp";
  const params: string[] = [];

  if (kw !== "") {
    sql += " WHERE username LIKE ? OR jabatan LIKE ? OR divisi LIKE ?";
    const like = `%${kw}%`;
    params.push(like, like, like);
  }
  sql += " ORDER BY created_at DESC, username ASC";

  const [rows] = await pool.query<(UserRow & RowDataPacket)[]>(sql, params);
  return rows;
}

export async function createUser(
  pool: Pool,
  username: string,
  password: string,
  jabatan: string,
  divisi: string
): Promise<ActionResult> {
  username = username.trim();
  password = password.trim();
  jabatan = jabatan.trim();
  divisi = divisi.trim();

  if (!username || !password || !jabatan || !divisi) {
    return { ok: false, msg: "Semua field wajib diisi." };
  }

  const [existing] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS c FROM usermlp WHERE username=?",
    [username]
  );
  if (Number(existing[0]?.c ?? 0) > 0) {
    return { ok: false, msg: "Username sudah ada. Pakai username lain." };
  }

  const hashed = await hashPassword(password);
  await pool.query(
    "INSERT INTO usermlp (username, password, jabatan, divisi) VALUES (?,?,?,?)",
    [username, hashed, jabatan, divisi]
  );

  return { ok: true, msg: "User berhasil dibuat." };
}

export async function updateUser(
  pool: Pool,
  oldUsername: string,
  username: string,
  password: string,
  jabatan: string,
  divisi: string
): Promise<ActionResult> {
  oldUsername = oldUsername.trim();
  username = username.trim();
  password = password.trim();
  jabatan = jabatan.trim();
  divisi = divisi.trim();

  if (!oldUsername || !username || !jabatan || !divisi) {
    return { ok: false, msg: "Data update tidak valid." };
  }

  if (username !== oldUsername) {
    const [existing] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS c FROM usermlp WHERE username=?",
      [username]
    );
    if (Number(existing[0]?.c ?? 0) > 0) {
      return { ok: false, msg: "Username sudah dipakai user lain." };
    }
  }

  if (password !== "") {
    const hashed = await hashPassword(password);
    await pool.query(
      "UPDATE usermlp SET username=?, password=?, jabatan=?, divisi=? WHERE username=?",
      [username, hashed, jabatan, divisi, oldUsername]
    );
  } else {
    await pool.query(
      "UPDATE usermlp SET username=?, jabatan=?, divisi=? WHERE username=?",
      [username, jabatan, divisi, oldUsername]
    );
  }

  return { ok: true, msg: "User berhasil diupdate." };
}

export async function deleteUser(
  pool: Pool,
  usernameDel: string,
  sessionUser: string
): Promise<ActionResult> {
  usernameDel = usernameDel.trim();
  if (!usernameDel) {
    return { ok: false, msg: "Data delete tidak valid." };
  }
  if (PROTECTED_USERS.includes(usernameDel)) {
    return {
      ok: false,
      msg: `User '${usernameDel}' tidak boleh dihapus (protected).`,
    };
  }
  if (usernameDel === sessionUser) {
    return { ok: false, msg: "Tidak bisa menghapus akun yang sedang login." };
  }

  await pool.query<ResultSetHeader>("DELETE FROM usermlp WHERE username=?", [
    usernameDel,
  ]);

  return { ok: true, msg: "User berhasil dihapus." };
}
