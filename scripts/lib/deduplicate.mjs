import { normalizedToken, similarity, unique } from "./text.mjs";

const priority = { brand_official: 6, official_document: 5, authorized_retailer: 4, public_database: 3, manual_json: 2, manual_csv: 2, user_provided: 1, user_review: 0 };

function primarySource(product) {
  return [...product.sources].sort((a, b) => (priority[b.sourceType] || 0) - (priority[a.sourceType] || 0))[0];
}

function choose(existing, incoming, field, conflicts) {
  const left = existing[field], right = incoming[field];
  if (left == null || left === "" || left === "unknown") return right;
  if (right == null || right === "" || right === "unknown") return left;
  if (JSON.stringify(left) !== JSON.stringify(right)) {
    conflicts.push({ field, conflictingValues: [left, right], status: "NEEDS_REVIEW" });
    return (priority[primarySource(incoming)?.sourceType] || 0) > (priority[primarySource(existing)?.sourceType] || 0) ? right : left;
  }
  return left;
}

function sameProduct(a, b) {
  if (a.brand.normalizedValue !== b.brand.normalizedValue) return false;
  if (a.taxonomy.category !== b.taxonomy.category) return false;
  const exact = normalizedToken(a.name.normalizedValue) === normalizedToken(b.name.normalizedValue);
  return exact || similarity(a.name.normalizedValue, b.name.normalizedValue) >= 0.91;
}

function mergeVariants(target, incoming) {
  for (const variant of incoming) {
    const found = target.find(item => {
      const left = item.shade.shadeCode || item.shade.shadeName;
      const right = variant.shade.shadeCode || variant.shade.shadeName;
      return normalizedToken(left) === normalizedToken(right) && item.region === variant.region;
    });
    if (!found) target.push(variant);
    else {
      found.sources = unique([...found.sources, ...variant.sources].map(item => JSON.stringify(item))).map(item => JSON.parse(item));
      found.prices.push(...variant.prices.filter(price => !found.prices.some(current => current.priceID === price.priceID)));
      for (const [field, value] of Object.entries(variant.shade)) if (found.shade[field] == null) found.shade[field] = value;
    }
  }
}

export function deduplicate(products) {
  const canonical = [], duplicates = [];
  for (const incoming of products) {
    const existing = canonical.find(product => sameProduct(product, incoming));
    if (!existing) { canonical.push(incoming); continue; }
    duplicates.push({ incomingProductID: incoming.canonicalProductID, canonicalProductID: existing.canonicalProductID, match: "brand_category_name", similarity: similarity(existing.name.normalizedValue, incoming.name.normalizedValue) });
    existing.description = choose(existing, incoming, "description", existing.conflicts);
    existing.coverage = choose(existing, incoming, "coverage", existing.conflicts);
    existing.finish = unique([...existing.finish, ...incoming.finish]);
    existing.claims.push(...incoming.claims);
    existing.performanceData.push(...incoming.performanceData);
    existing.ingredientLists.push(...incoming.ingredientLists);
    existing.images.officialPrimary ||= incoming.images.officialPrimary;
    for (const key of ["officialSecondary", "officialSwatches", "retailerImages", "userImages", "simulatedImages"]) {
      existing.images[key] = unique([...(existing.images[key] || []), ...(incoming.images[key] || [])]);
    }
    existing.images.textureReference ||= incoming.images.textureReference;
    existing.imageSources.push(...incoming.imageSources);
    existing.sources.push(...incoming.sources);
    existing.searchTags = unique([...existing.searchTags, ...incoming.searchTags]);
    existing.originalRecords.push(...incoming.originalRecords);
    existing.reviewFlags = unique([...existing.reviewFlags, ...incoming.reviewFlags]);
    mergeVariants(existing.variants, incoming.variants);
  }
  return { products: canonical, duplicates };
}
