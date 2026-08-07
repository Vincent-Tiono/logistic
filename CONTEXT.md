# Coal Barging Logistics

Operations management system for coal barging logistics (Bahasa Indonesia-speaking team) — tracks master reference data and logs operational events (timing, quantities) for barge shipments.

## Language

**Master Data**:
Reference entities (Vessel, Shipper, Vendor, Barges, Jetty, FLF) entered directly by users with no calculated fields. Source data consumed by Operation and reporting modules.

**Operation**:
A logged record of an actual event with timestamps and quantities, plus derived/calculated fields (e.g. cycle time). Consumes Master Data but adds time-based measurement and computation on top. Current Operations: TLU Operation, Coal-Barging.
_Avoid_: using "operation" loosely for any module — it specifically means the timestamp+quantity+calculation layer.

**SI-Barges**:
A reporting/export module that reads Master Data and produces PDF output. Not an Operation (no timestamp/quantity logging of its own) and not Master Data itself (doesn't originate data).
