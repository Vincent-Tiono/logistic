import PizZip from "pizzip";
import { describe, expect, it } from "vitest";
import { formatTanggalID } from "../../src/lib/bi-kurs.js";
import {
  buildSpalDocx,
  buildSpalFilename,
  formatRupiahAmount,
  type SpalAgreement,
} from "../../src/services/spal.service.js";

describe("formatRupiahAmount", () => {
  it("dot-groups thousands with no decimals", () => {
    expect(formatRupiahAmount(1_500_000_000)).toBe("1.500.000.000");
    expect(formatRupiahAmount(35_000_000)).toBe("35.000.000");
    expect(formatRupiahAmount(999)).toBe("999");
    expect(formatRupiahAmount(1000)).toBe("1.000");
  });

  it("rounds non-integer input", () => {
    expect(formatRupiahAmount(1_500_000.6)).toBe("1.500.001");
  });
});

function fixtureAgreement(overrides: Partial<SpalAgreement> = {}): SpalAgreement {
  return {
    id: 1,
    operator: "MHU",
    kapal: [{ tugboat: "TB. MARINA 2201", barge: "BG. MARINE POWER 3037" }],
    nomor: "001/SJN-SPAL/MLP/VIII/2026",
    tanggal: "2026-08-18",
    namaPt: "Contoh Mining & Co",
    alamat: "Jl. Sudirman No. 1\nJakarta Selatan",
    uangTambang: 1_500_000_000,
    deadfreight: 0,
    jettyMuat: "Jetty Taboneo",
    jettyBongkar: "Jetty Suralaya",
    kesediaanKapalMulai: "2026-05-09",
    kesediaanKapalSelesai: "2026-05-11",
    posisiKapal: "Perairan Taboneo",
    totalHariMuatBongkar: "7 Hari",
    dendaDemurrage: 35_000_000,
    namaPenandatangan: "Budi Santoso",
    jabatan: "Direktur Utama",
    createdAt: "2026-08-18T00:00:00.000Z",
    ...overrides,
  };
}

function extractDocumentXml(buffer: Buffer): string {
  const zip = new PizZip(buffer);
  return zip.file("word/document.xml")!.asText();
}

describe("buildSpalDocx", () => {
  it("fills every placeholder token and leaves no %%TOKEN%% markers behind", () => {
    const buffer = buildSpalDocx(fixtureAgreement());
    const xml = extractDocumentXml(buffer);
    expect(xml).not.toMatch(/%%[A-Z_]+%%/);
  });

  it("writes the agreement number into all three occurrences (Bagian I, Bagian II, closing paragraph)", () => {
    const buffer = buildSpalDocx(fixtureAgreement({ nomor: "007/UNIQUE-NOMOR/2026" }));
    const xml = extractDocumentXml(buffer);
    const count = xml.split("007/UNIQUE-NOMOR/2026").length - 1;
    expect(count).toBe(3);
  });

  it("writes the customer/signatory name into all three occurrences (table cell + two signature blocks)", () => {
    const buffer = buildSpalDocx(fixtureAgreement({ namaPt: "Unik Sekali Mining" }));
    const xml = extractDocumentXml(buffer);
    const count = xml.split("Unik Sekali Mining").length - 1;
    expect(count).toBe(3);
  });

  it("keeps the address paragraph's own runs intact next to the reused NAMA_PT paragraph", () => {
    const buffer = buildSpalDocx(
      fixtureAgreement({ namaPt: "Unik Sekali Mining", alamat: "Jl. A\nJakarta" })
    );
    const xml = extractDocumentXml(buffer);
    // Regression guard: a prior regex bug let the ALAMAT-run match swallow
    // the neighboring NAMA_PT paragraph, duplicating "PT Unik Sekali Mining"
    // into the address paragraph too.
    expect(xml.split("Unik Sekali Mining").length - 1).toBe(3);
    expect(xml).toContain("Jl. A");
    expect(xml).toContain("Jakarta");
  });

  it("uses today's date (not the stored tanggal) in Indonesian long form", () => {
    const buffer = buildSpalDocx(fixtureAgreement({ tanggal: "2026-08-18" }));
    const xml = extractDocumentXml(buffer);
    const today = formatTanggalID(new Date().toISOString().slice(0, 10));
    expect(xml).toContain(today);
  });

  it("splits a multi-line address into separate runs joined by <w:br/>", () => {
    const buffer = buildSpalDocx(
      fixtureAgreement({ alamat: "Baris Pertama\nBaris Kedua\nBaris Ketiga" })
    );
    const xml = extractDocumentXml(buffer);
    expect(xml).toContain("Baris Pertama");
    expect(xml).toContain("Baris Kedua");
    expect(xml).toContain("Baris Ketiga");
    expect(xml).toMatch(/Baris Pertama<\/w:t><\/w:r><w:r>.*?<w:br\s*\/>.*?Baris Kedua/);
  });

  it("computes the demurrage clause with formatted amount and Indonesian terbilang", () => {
    const buffer = buildSpalDocx(fixtureAgreement({ dendaDemurrage: 35_000_000 }));
    const xml = extractDocumentXml(buffer);
    expect(xml).toContain("Rp. 35.000.000");
    expect(xml).toContain("Tiga Puluh Lima Juta Rupiah Per Hari Pro Rata");
  });

  it("uses a custom demurrage override consistently in amount and terbilang", () => {
    const buffer = buildSpalDocx(fixtureAgreement({ dendaDemurrage: 50_000_000 }));
    const xml = extractDocumentXml(buffer);
    expect(xml).toContain("Rp. 50.000.000");
    expect(xml).toContain("Lima Puluh Juta Rupiah Per Hari Pro Rata");
  });

  it("shows Tidak ada for the demurrage clause when no amount is set", () => {
    const buffer = buildSpalDocx(fixtureAgreement({ dendaDemurrage: 0 }));
    const xml = extractDocumentXml(buffer);
    expect(xml).toContain("Tidak ada");
    expect(xml).not.toContain("Hari Pro Rata");
  });

  it("formats Uang Tambang with Indonesian thousand separators", () => {
    const buffer = buildSpalDocx(fixtureAgreement({ uangTambang: 1_500_000_000 }));
    const xml = extractDocumentXml(buffer);
    expect(xml).toContain("Rp. 1.500.000.000");
  });

  it("XML-escapes ampersands and angle brackets in free-text fields", () => {
    const buffer = buildSpalDocx(fixtureAgreement({ namaPt: "A&B <Trading>" }));
    const xml = extractDocumentXml(buffer);
    expect(xml).toContain("A&amp;B &lt;Trading&gt;");
    expect(xml).not.toContain("A&B <Trading>");
  });

  it("produces a valid, re-readable zip/docx buffer", () => {
    const buffer = buildSpalDocx(fixtureAgreement());
    expect(() => new PizZip(buffer)).not.toThrow();
  });

  it("formats the Kesediaan Kapal date range with an en dash when month/year match", () => {
    const buffer = buildSpalDocx(
      fixtureAgreement({ kesediaanKapalMulai: "2026-05-09", kesediaanKapalSelesai: "2026-05-11" })
    );
    const xml = extractDocumentXml(buffer);
    expect(xml).toContain("9 – 11 Mei 2026");
  });

  it("formats the Kesediaan Kapal date range with full dates when months differ", () => {
    const buffer = buildSpalDocx(
      fixtureAgreement({ kesediaanKapalMulai: "2026-05-30", kesediaanKapalSelesai: "2026-06-02" })
    );
    const xml = extractDocumentXml(buffer);
    expect(xml).toContain("30 Mei 2026 – 2 Juni 2026");
  });

  it("writes Posisi Kapal and Total Hari Muat/Bongkar as free text", () => {
    const buffer = buildSpalDocx(
      fixtureAgreement({ posisiKapal: "Perairan Balikpapan", totalHariMuatBongkar: "CQD" })
    );
    const xml = extractDocumentXml(buffer);
    expect(xml).toContain("Perairan Balikpapan");
    expect(xml).toContain("CQD");
  });

  it("writes a single Nama dan Data Kapal pair as plain text, no bullet", () => {
    const buffer = buildSpalDocx(
      fixtureAgreement({
        kapal: [{ tugboat: "TB. EQUATOR 09", barge: "BG. FINANCIA 39" }],
      })
    );
    const xml = extractDocumentXml(buffer);
    expect(xml).toContain(">TB. EQUATOR 09 / BG. FINANCIA 39<");
  });

  it("writes multiple Nama dan Data Kapal pairs as a bulleted list, one per line", () => {
    const buffer = buildSpalDocx(
      fixtureAgreement({
        kapal: [
          { tugboat: "TB. EQUATOR 09", barge: "BG. FINANCIA 39" },
          { tugboat: "TB. MARINA 2201", barge: "BG. MARINE POWER 3037" },
        ],
      })
    );
    const xml = extractDocumentXml(buffer);
    expect(xml).toContain("• TB. EQUATOR 09 / BG. FINANCIA 39");
    expect(xml).toContain("• TB. MARINA 2201 / BG. MARINE POWER 3037");
    expect(xml).toMatch(
      /EQUATOR 09 \/ BG\. FINANCIA 39<\/w:t><\/w:r><w:r>.*?<w:br\s*\/>.*?<\/w:r><w:r>.*?MARINA 2201/
    );
  });

  it("writes Deadfreight into the SNP template", () => {
    const buffer = buildSpalDocx(
      fixtureAgreement({ operator: "SNP", deadfreight: 5_000 })
    );
    const xml = extractDocumentXml(buffer);
    expect(xml).toContain("5.000 MT");
  });

  it("builds a filename from the sanitized nomor", () => {
    const filename = buildSpalFilename(
      fixtureAgreement({ operator: "SJN", nomor: "001/SJN-SPAL/MLP/VIII/2026" })
    );
    expect(filename).toBe("SJN-SPAL-001_SJN-SPAL_MLP_VIII_2026.docx");
  });
});
