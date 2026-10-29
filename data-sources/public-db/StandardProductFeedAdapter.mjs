import fs from "node:fs/promises";
import { BaseAdapter, asArray, sourceFrom } from "../core/BaseAdapter.mjs";

const ALLOWED_METHODS = new Set(["official_api", "affiliate_feed", "merchant_feed", "product_feed", "public_endpoint"]);

function valueAt(object, path) {
  if (!path) return undefined;
  return path.split(".").reduce((value, key) => value?.[key], object);
}

export class StandardProductFeedAdapter extends BaseAdapter {
  constructor(options = {}) {
    super("standard-product-feed", options);
  }

  supports(config = {}) {
    return config.adapter === this.id;
  }

  async import(config = {}) {
    if (!ALLOWED_METHODS.has(config.accessMethod) || config.termsAccepted !== true) {
      throw new Error("standard-product-feed: explicit permitted accessMethod and termsAccepted=true are required");
    }
    let payload;
    if (config.input) payload = JSON.parse(await fs.readFile(config.input, "utf8"));
    else if (config.url && config.allowRemote === true) {
      const response = await fetch(config.url, { headers: config.headers || {} });
      if (!response.ok) throw new Error(`standard-product-feed: source unavailable (${response.status})`);
      payload = await response.json();
    } else throw new Error("standard-product-feed: local input or explicitly allowed remote URL is required");

    const source = sourceFrom(config, "public_database");
    const records = asArray(valueAt(payload, config.itemsPath) ?? payload.products ?? payload.items ?? payload);
    const mapping = config.fieldMap || {};
    return records.map((record, index) => {
      const rawProduct = mapping.brand ? {
        brand: valueAt(record, mapping.brand),
        name: valueAt(record, mapping.name),
        category: valueAt(record, mapping.category),
        subcategory: valueAt(record, mapping.subcategory),
        format: valueAt(record, mapping.format),
        variants: valueAt(record, mapping.variants),
        ingredients: valueAt(record, mapping.ingredients),
        price: valueAt(record, mapping.price),
        currency: valueAt(record, mapping.currency),
        productUrl: valueAt(record, mapping.productUrl),
        imageUrl: valueAt(record, mapping.imageUrl),
        description: valueAt(record, mapping.description),
        originalRecord: record
      } : record;
      return this.result(source, rawProduct, { row: index + 1, accessMethod: config.accessMethod });
    });
  }
}
