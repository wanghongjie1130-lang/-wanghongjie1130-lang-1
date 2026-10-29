import fs from "node:fs/promises";
import { BaseAdapter, sourceFrom } from "../core/BaseAdapter.mjs";

export function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(field); field = ""; }
    else if (char === '\n') { row.push(field); rows.push(row); row = []; field = ""; }
    else if (char !== '\r') field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter(values => values.some(value => value.trim() !== ""));
}

function get(row, fieldMap, key) {
  const sourceKey = fieldMap[key] || key;
  return row[sourceKey] == null || row[sourceKey] === "" ? null : row[sourceKey];
}

export class ManualCsvAdapter extends BaseAdapter {
  constructor(options = {}) {
    super("manual-csv", options);
  }

  supports(config = {}) {
    return config.adapter === this.id || /\.csv$/i.test(config.input || "");
  }

  async import(config = {}) {
    const text = config.text ?? await fs.readFile(config.input, "utf8");
    const matrix = parseCsv(text);
    if (matrix.length < 2) throw new Error("manual-csv: CSV contains no data rows");
    const headers = matrix[0].map(value => value.trim());
    const source = sourceFrom(config, "manual_csv");
    const fieldMap = config.fieldMap || {};
    return matrix.slice(1).map((values, index) => {
      const row = Object.fromEntries(headers.map((header, i) => [header, values[i]?.trim() ?? ""]));
      const rawProduct = {
        brand: get(row, fieldMap, "brand"),
        name: get(row, fieldMap, "product_name") || get(row, fieldMap, "name"),
        category: get(row, fieldMap, "category"),
        subcategory: get(row, fieldMap, "subcategory"),
        format: get(row, fieldMap, "format"),
        shade: get(row, fieldMap, "shade"),
        price: get(row, fieldMap, "price"),
        currency: get(row, fieldMap, "currency"),
        finish: get(row, fieldMap, "finish"),
        texture: get(row, fieldMap, "texture"),
        ingredients: (get(row, fieldMap, "ingredients") || "").split(/;|\|/).map(x => x.trim()).filter(Boolean),
        productUrl: get(row, fieldMap, "product_url"),
        imageUrl: get(row, fieldMap, "image_url"),
        originalRow: row
      };
      return this.result(source, rawProduct, { row: index + 2, input: config.input || "inline" });
    });
  }
}
