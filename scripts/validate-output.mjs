import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = async file => JSON.parse(await fs.readFile(path.join(root, file), "utf8"));
const index = await read("data/products-index.json");
const dashboard = await read("data/dashboard.json");
const errors = [];
if (!index.length) errors.push("products-index.json is empty");
if (dashboard.products !== index.length) errors.push("dashboard product count does not match index");
for (const item of index) {
  if (!item.id || !item.brand || !item.name || !item.detailPath) errors.push(`invalid index item: ${item.id || "unknown"}`);
  try { await fs.access(path.join(root, item.detailPath)); } catch { errors.push(`missing detail file: ${item.detailPath}`); }
}
const generated = await fs.readFile(path.join(root, "js/generated-products.js"), "utf8");
if (/"demo"\s*:\s*true/.test(generated)) errors.push("generated compatibility bundle contains demo products");
if (errors.length) { console.error(errors.join("\n")); process.exitCode = 1; }
else console.log(`Validated ${index.length} canonical products and ${index.reduce((sum, item) => sum + item.shades.length, 0)} variants.`);
