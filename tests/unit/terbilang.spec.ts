import { describe, expect, it } from "vitest";
import { terbilang } from "../../src/lib/terbilang.js";

describe("terbilang", () => {
  it("converts single digits", () => {
    expect(terbilang(0)).toBe("Nol");
    expect(terbilang(5)).toBe("Lima");
    expect(terbilang(9)).toBe("Sembilan");
  });

  it("converts teens using 'Belas'", () => {
    expect(terbilang(10)).toBe("Sepuluh");
    expect(terbilang(11)).toBe("Sebelas");
    expect(terbilang(12)).toBe("Dua Belas");
    expect(terbilang(19)).toBe("Sembilan Belas");
  });

  it("converts tens", () => {
    expect(terbilang(20)).toBe("Dua Puluh");
    expect(terbilang(35)).toBe("Tiga Puluh Lima");
    expect(terbilang(99)).toBe("Sembilan Puluh Sembilan");
  });

  it("converts hundreds, using 'Seratus' for the 100 special case", () => {
    expect(terbilang(100)).toBe("Seratus");
    expect(terbilang(101)).toBe("Seratus Satu");
    expect(terbilang(250)).toBe("Dua Ratus Lima Puluh");
    expect(terbilang(999)).toBe("Sembilan Ratus Sembilan Puluh Sembilan");
  });

  it("converts thousands, using 'Seribu' for the 1000 special case", () => {
    expect(terbilang(1000)).toBe("Seribu");
    expect(terbilang(1500)).toBe("Seribu Lima Ratus");
    expect(terbilang(2000)).toBe("Dua Ribu");
    expect(terbilang(35000)).toBe("Tiga Puluh Lima Ribu");
  });

  it("converts millions", () => {
    expect(terbilang(1000000)).toBe("Satu Juta");
    expect(terbilang(35000000)).toBe("Tiga Puluh Lima Juta");
    expect(terbilang(1500000000)).toBe("Satu Milyar Lima Ratus Juta");
  });

  it("matches the SPAL template's default demurrage amount", () => {
    expect(terbilang(35_000_000)).toBe("Tiga Puluh Lima Juta");
  });

  it("throws on negative or non-integer input", () => {
    expect(() => terbilang(-1)).toThrow();
    expect(() => terbilang(1.5)).toThrow();
  });
});
