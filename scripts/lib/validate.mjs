const statusLabel = {
  VERIFIED: "VERIFIED", PARTIALLY_VERIFIED: "PARTIALLY VERIFIED", DATA_INCOMPLETE: "DATA INCOMPLETE",
  OUTDATED: "OUTDATED", DISCONTINUED: "DISCONTINUED", NEEDS_REVIEW: "NEEDS REVIEW"
};

function validUrl(value) {
  if (!value) return true;
  try { const url = new URL(value, "https://local.invalid"); return ["http:", "https:", "file:"].includes(url.protocol); } catch { return false; }
}

function completeness(product) {
  const sections = {
    basic: Boolean(product.brand.originalValue && product.name.originalValue && product.taxonomy.category !== "unknown"),
    color: product.variants.some(variant => variant.shade.shadeName && variant.shade.shadeName !== "Default 1"),
    ingredients: product.ingredientLists.some(list => list.ingredients.length),
    performance: product.performanceData.length > 0,
    price: product.variants.some(variant => variant.prices.length),
    image: Boolean(product.images.officialPrimary || product.images.retailerImages.length || product.images.userImages.length || product.images.textureReference),
    source: product.sources.some(source => source.sourceURL || source.source)
  };
  const score = Math.round(Object.values(sections).filter(Boolean).length / Object.keys(sections).length * 100);
  return { score, sections };
}

function isOutdated(product, now = new Date()) {
  const latest = product.sources.map(source => Date.parse(source.retrievedAt)).filter(Number.isFinite).sort((a, b) => b - a)[0];
  return latest ? now.getTime() - latest > 365 * 24 * 60 * 60 * 1000 : true;
}

export function validateProduct(product, now = new Date()) {
  const errors = [], warnings = [];
  if (!product.brand.originalValue) errors.push({ code: "MISSING_BRAND", field: "brand" });
  if (!product.name.originalValue) errors.push({ code: "MISSING_PRODUCT_NAME", field: "name" });
  if (product.taxonomy.category === "unknown") warnings.push({ code: "UNMAPPED_CATEGORY", field: "taxonomy" });
  for (const source of product.sources) if (!validUrl(source.sourceURL)) errors.push({ code: "INVALID_SOURCE_URL", field: "sources", sourceID: source.sourceID });
  for (const variant of product.variants) for (const price of variant.prices) {
    if (!Number.isFinite(price.price) || price.price < 0) errors.push({ code: "INVALID_PRICE", field: "prices", variantID: variant.variantID });
    if (!price.currency) warnings.push({ code: "MISSING_CURRENCY", field: "prices", variantID: variant.variantID });
  }
  if (!product.ingredientLists.length) warnings.push({ code: "INGREDIENTS_INCOMPLETE", field: "ingredientLists" });
  if (product.conflicts.length) warnings.push({ code: "CONFLICTING_VALUES", field: "conflicts" });
  const dataCompleteness = completeness(product);
  let status = "DATA_INCOMPLETE";
  if (product.conflicts.length || product.reviewFlags.length) status = "NEEDS_REVIEW";
  else if (isOutdated(product, now)) status = "OUTDATED";
  else if (dataCompleteness.score >= 85 && product.sources.some(source => source.verifiedAt)) status = "VERIFIED";
  else if (dataCompleteness.score >= 55) status = "PARTIALLY_VERIFIED";
  product.dataCompleteness = dataCompleteness;
  product.status = { code: status, label: statusLabel[status] };
  return { valid: errors.length === 0, errors, warnings, product };
}
