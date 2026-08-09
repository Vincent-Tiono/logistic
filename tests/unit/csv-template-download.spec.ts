import { describe, expect, it } from "vitest";
import { parseCsv } from "../../src/lib/csv-parser.js";
import { buildBargesTemplateCsv, IMPORT_REQUIRED_COLUMNS as BARGES_TEMPLATE_COLUMNS } from "../../src/services/barges.service.js";
import { buildFlfTemplateCsv, IMPORT_REQUIRED_COLUMNS as FLF_TEMPLATE_COLUMNS } from "../../src/services/flf.service.js";
import { buildJettyTemplateCsv, IMPORT_REQUIRED_COLUMNS as JETTY_TEMPLATE_COLUMNS } from "../../src/services/jetty.service.js";
import { buildShipperTemplateCsv, SHIPPER_TEMPLATE_COLUMNS } from "../../src/services/shipper.service.js";
import { buildSibargesTemplateCsv, IMPORT_REQUIRED_COLUMNS as SIBARGES_TEMPLATE_COLUMNS } from "../../src/services/sibarges.service.js";
import { buildVendorTemplateCsv, VENDOR_TEMPLATE_COLUMNS } from "../../src/services/vendor.service.js";
import { buildVesselTemplateCsv, VESSEL_TEMPLATE_COLUMNS } from "../../src/services/vessel.service.js";

describe("buildVesselTemplateCsv", () => {
  it("returns a header row matching VESSEL_TEMPLATE_COLUMNS, plus one example row, and the legacy filename", () => {
    const { filename, csv } = buildVesselTemplateCsv();
    expect(filename).toBe("vessel_template.csv");

    const rows = parseCsv(csv);
    expect(rows[0]).toEqual([...VESSEL_TEMPLATE_COLUMNS]);
    expect(rows).toHaveLength(2); // header + 1 example row
    expect(rows[1]).toHaveLength(VESSEL_TEMPLATE_COLUMNS.length);
  });
});

describe("buildShipperTemplateCsv", () => {
  it("returns a header row matching SHIPPER_TEMPLATE_COLUMNS, plus one example row (embedded newlines quoted), and the legacy filename", () => {
    const { filename, csv } = buildShipperTemplateCsv();
    expect(filename).toBe("shipper_template.csv");

    const rows = parseCsv(csv);
    expect(rows[0]).toEqual([...SHIPPER_TEMPLATE_COLUMNS]);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toHaveLength(SHIPPER_TEMPLATE_COLUMNS.length);
    expect(rows[1][0]).toBe("MHU");
  });
});

describe("buildVendorTemplateCsv", () => {
  it("returns a header row matching VENDOR_TEMPLATE_COLUMNS (incl. optional freight), plus one example row, and the legacy filename", () => {
    const { filename, csv } = buildVendorTemplateCsv();
    expect(filename).toBe("vendor_template.csv");

    const rows = parseCsv(csv);
    expect(rows[0]).toEqual([...VENDOR_TEMPLATE_COLUMNS]);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toHaveLength(VENDOR_TEMPLATE_COLUMNS.length);
  });
});

describe("buildBargesTemplateCsv", () => {
  it("returns a header row matching BARGES_TEMPLATE_COLUMNS, plus one example row, and the legacy filename", () => {
    const { filename, csv } = buildBargesTemplateCsv();
    expect(filename).toBe("barges_template.csv");

    const rows = parseCsv(csv);
    expect(rows[0]).toEqual([...BARGES_TEMPLATE_COLUMNS]);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toHaveLength(BARGES_TEMPLATE_COLUMNS.length);
  });
});

describe("buildJettyTemplateCsv", () => {
  it("returns a header row matching JETTY_TEMPLATE_COLUMNS, quotes the comma-containing example value, and the legacy filename", () => {
    const { filename, csv } = buildJettyTemplateCsv();
    expect(filename).toBe("jetty_template.csv");

    const rows = parseCsv(csv);
    expect(rows[0]).toEqual([...JETTY_TEMPLATE_COLUMNS]);
    expect(rows).toHaveLength(2);
    expect(rows[1][0]).toBe("ABK");
    expect(rows[1][1]).toContain(",");
  });
});

describe("buildFlfTemplateCsv", () => {
  it("returns a header row matching FLF_TEMPLATE_COLUMNS, plus one example row, and the legacy filename", () => {
    const { filename, csv } = buildFlfTemplateCsv();
    expect(filename).toBe("flf_template.csv");

    const rows = parseCsv(csv);
    expect(rows[0]).toEqual([...FLF_TEMPLATE_COLUMNS]);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toHaveLength(FLF_TEMPLATE_COLUMNS.length);
  });
});

describe("buildSibargesTemplateCsv", () => {
  it("returns a header row matching SIBARGES_TEMPLATE_COLUMNS, plus one example row, and the legacy filename", () => {
    const { filename, csv } = buildSibargesTemplateCsv();
    expect(filename).toBe("sibarges_template.csv");

    const rows = parseCsv(csv);
    expect(rows[0]).toEqual([...SIBARGES_TEMPLATE_COLUMNS]);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toHaveLength(SIBARGES_TEMPLATE_COLUMNS.length);
  });
});
