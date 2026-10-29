import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ManualCsvAdapter, parseCsv } from "../data-sources/manual/ManualCsvAdapter.mjs";
import { ManualJsonAdapter } from "../data-sources/manual/ManualJsonAdapter.mjs";
import { StandardProductFeedAdapter } from "../data-sources/public-db/StandardProductFeedAdapter.mjs";
import { normalizeEnvelope } from "../scripts/lib/normalize.mjs";
import { deduplicate } from "../scripts/lib/deduplicate.mjs";
import { validateProduct } from "../scripts/lib/validate.mjs";

const source = { id: "test", name: "Test source", type: "manual_json", region: "CN", retrievedAt: "2026-10-29T00:00:00Z", verifiedAt: null, confidence: 0.4, usagePermission: "test_only" };

test("CSV parser keeps quoted commas and maps fields", async () => {
  const rows = parseCsv('brand,product_name,category,ingredients\n"Brand, Lab",Test,lipstick,"A;B"\n');
  assert.equal(rows[1][0], "Brand, Lab");
  const result = await new ManualCsvAdapter().import({ text: 'brand,product_name,category\nMAC,Test Lipstick,lipstick\n', source });
  assert.equal(result[0].rawProduct.name, "Test Lipstick");
});

test("JSON adapter accepts arrays and nested variants", async () => {
  const result = await new ManualJsonAdapter().import({ data: { source, products: [{ brand: "Dior", name: "Test", category: "lipstick", variants: [{ shadeName: "001" }] }] } });
  const product = normalizeEnvelope(result[0]);
  assert.equal(product.variants[0].shade.shadeName, "001");
  assert.equal(product.taxonomy.category, "lip_color");
});

test("standard feed refuses use without explicit permission", async () => {
  await assert.rejects(() => new StandardProductFeedAdapter().import({ input: "missing.json" }), /termsAccepted/);
});

test("standard feed imports a permitted local feed", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "sevb-feed-"));
  const file = path.join(dir, "feed.json");
  await fs.writeFile(file, JSON.stringify({ items: [{ maker: "NARS", title: "Test Blush", kind: "blush" }] }));
  const result = await new StandardProductFeedAdapter().import({
    input: file, accessMethod: "product_feed", termsAccepted: true, source: { ...source, type: "public_database" },
    itemsPath: "items", fieldMap: { brand: "maker", name: "title", category: "kind" }
  });
  assert.equal(result[0].rawProduct.brand, "NARS");
});

test("deduplication keeps sources and variants", () => {
  const a = normalizeEnvelope({ source, rawProduct: { brand: "YSL", name: "Test Lip", category: "lipstick", shade: "01" }, context: {} });
  const b = normalizeEnvelope({ source: { ...source, id: "test-2", type: "authorized_retailer" }, rawProduct: { brand: "Yves Saint Laurent", name: "Test Lip", category: "lipstick", shade: "02" }, context: {} });
  const result = deduplicate([a, b]);
  assert.equal(result.products.length, 1);
  assert.equal(result.products[0].variants.length, 2);
  assert.equal(result.duplicates.length, 1);
});

test("validation treats missing ingredients as unknown", () => {
  const product = normalizeEnvelope({ source, rawProduct: { brand: "MAC", name: "Test", category: "lipstick" }, context: {} });
  const result = validateProduct(product, new Date("2026-10-29T00:00:00Z"));
  assert.ok(result.warnings.some(item => item.code === "INGREDIENTS_INCOMPLETE"));
  assert.notEqual(result.product.status.code, "VERIFIED");
});
