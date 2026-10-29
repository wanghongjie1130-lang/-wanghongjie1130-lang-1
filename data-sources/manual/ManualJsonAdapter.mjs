import fs from "node:fs/promises";
import { BaseAdapter, asArray, sourceFrom } from "../core/BaseAdapter.mjs";

export class ManualJsonAdapter extends BaseAdapter {
  constructor(options = {}) {
    super("manual-json", options);
  }

  supports(config = {}) {
    return config.adapter === this.id || /\.json$/i.test(config.input || "");
  }

  async import(config = {}) {
    const payload = config.data ?? JSON.parse(await fs.readFile(config.input, "utf8"));
    const source = sourceFrom({ ...config, source: payload.source || config.source }, "manual_json");
    const products = Array.isArray(payload) ? payload : asArray(payload.products ?? payload.items ?? payload.product ?? payload);
    return products.map((rawProduct, index) => this.result(source, rawProduct, { row: index + 1, input: config.input || "inline" }));
  }
}
