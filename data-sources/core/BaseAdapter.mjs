export class BaseAdapter {
  constructor(id, options = {}) {
    this.id = id;
    this.options = options;
  }

  supports() {
    return false;
  }

  async import() {
    throw new Error(`${this.id}: import() is not implemented`);
  }

  result(source, rawProduct, context = {}) {
    if (!source?.id || !source?.type) {
      throw new Error(`${this.id}: every record requires source.id and source.type`);
    }
    return { source, rawProduct, context: { adapter: this.id, ...context } };
  }
}

export function asArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

export function sourceFrom(config = {}, fallbackType) {
  const source = config.source || {};
  return {
    id: source.id || config.sourceId || `${fallbackType}-unknown`,
    name: source.name || config.sourceName || source.id || "Unknown source",
    type: source.type || fallbackType,
    url: source.url || config.url || null,
    region: source.region || config.region || "GLOBAL",
    retrievedAt: source.retrievedAt || config.retrievedAt || new Date().toISOString(),
    verifiedAt: source.verifiedAt || null,
    confidence: Number.isFinite(source.confidence) ? source.confidence : 0.4,
    usagePermission: source.usagePermission || config.usagePermission || "manual_review_required"
  };
}
