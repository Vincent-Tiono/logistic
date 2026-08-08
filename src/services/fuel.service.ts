import type { Pool, RowDataPacket } from "mysql2/promise";

export type ActionResult = { ok: true } | { ok: false; error: string };

export const FUEL_VALUE_FIELDS = ["pertamina", "ici3"] as const;
export type FuelValueField = (typeof FUEL_VALUE_FIELDS)[number];

export const FUEL_RATE_FIELDS = ["ppn_rate", "pbbkb_rate", "pph22_rate"] as const;
export type FuelRateField = (typeof FUEL_RATE_FIELDS)[number];

function isFuelValueField(field: string): field is FuelValueField {
  return (FUEL_VALUE_FIELDS as readonly string[]).includes(field);
}

function isFuelRateField(field: string): field is FuelRateField {
  return (FUEL_RATE_FIELDS as readonly string[]).includes(field);
}

export interface FuelCell {
  pertamina: number;
  ici3: number;
}

export type FuelData = Record<string, Record<number, FuelCell>>;

export async function listFuelData(pool: Pool): Promise<FuelData> {
  const [rows] = await pool.query<
    (RowDataPacket & {
      bulan_tahun: string;
      periode: number;
      pertamina: string;
      ici3: string;
    })[]
  >("SELECT bulan_tahun, periode, pertamina, ici3 FROM fuel");

  const data: FuelData = {};
  for (const row of rows) {
    const bt = row.bulan_tahun;
    data[bt] ??= {};
    data[bt][Number(row.periode)] = {
      pertamina: Number(row.pertamina),
      ici3: Number(row.ici3),
    };
  }
  return data;
}

export interface FuelRates {
  ppnRate: number;
  pbbkbRate: number;
  pph22Rate: number;
}

export const DEFAULT_FUEL_RATES: FuelRates = {
  ppnRate: 11,
  pbbkbRate: 7.5,
  pph22Rate: 0.3,
};

export async function getFuelRates(pool: Pool, tahun: number): Promise<FuelRates> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT ppn_rate, pbbkb_rate, pph22_rate FROM fuel_rates WHERE tahun = ?",
    [tahun]
  );
  const row = rows[0];
  if (!row) return { ...DEFAULT_FUEL_RATES };
  return {
    ppnRate: Number(row.ppn_rate),
    pbbkbRate: Number(row.pbbkb_rate),
    pph22Rate: Number(row.pph22_rate),
  };
}

export interface SaveFuelValueInput {
  bulanTahun: string;
  periode: number;
  field: string;
  value: number;
}

export async function saveFuelValue(
  pool: Pool,
  input: SaveFuelValueInput
): Promise<ActionResult> {
  const bulanTahun = input.bulanTahun.trim();
  if (
    bulanTahun === "" ||
    (input.periode !== 1 && input.periode !== 2) ||
    !isFuelValueField(input.field)
  ) {
    return { ok: false, error: "Invalid input" };
  }

  const field = input.field;
  await pool.query(
    `INSERT INTO fuel (bulan_tahun, periode, ${field}) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE ${field} = VALUES(${field})`,
    [bulanTahun, input.periode, input.value]
  );
  return { ok: true };
}

export interface SaveFuelRateInput {
  tahun: number;
  field: string;
  value: number;
}

export async function saveFuelRate(
  pool: Pool,
  input: SaveFuelRateInput
): Promise<ActionResult> {
  if (input.tahun <= 0 || !isFuelRateField(input.field)) {
    return { ok: false, error: "Invalid input" };
  }

  const field = input.field;
  await pool.query(
    `INSERT INTO fuel_rates (tahun, ${field}) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE ${field} = VALUES(${field})`,
    [input.tahun, input.value]
  );
  return { ok: true };
}
