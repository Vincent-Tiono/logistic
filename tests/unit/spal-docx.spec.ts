import PizZip from "pizzip";
import { describe, expect, it } from "vitest";
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
    nomor: "001/SJN-SPAL/MLP/VIII/2026",
    tanggal: "2026-08-18",
    namaPt: "Contoh Mining & Co",
    alamat: "Jl. Sudirman No. 1\nJakarta Selatan",
    uangTambang: 1_500_000_000,
    jettyMuat: "Jetty Taboneo",
    jettyBongkar: "Jetty Suralaya",
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

  it("formats the date in Indonesian long form", () => {
    const buffer = buildSpalDocx(fixtureAgreement({ tanggal: "2026-08-18" }));
    const xml = extractDocumentXml(buffer);
    expect(xml).toContain("18 Agustus 2026");
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

  it("builds a filename from the sanitized nomor", () => {
    const filename = buildSpalFilename(
      fixtureAgreement({ nomor: "001/SJN-SPAL/MLP/VIII/2026" })
    );
    expect(filename).toBe("SJN-SPAL-001_SJN-SPAL_MLP_VIII_2026.docx");
  });
});
