import { clean, normalizedToken, stableId, unique } from "./text.mjs";
import { mapTaxonomy, normalizeFinishes } from "./taxonomy.mjs";

const BRAND_ALIASES = new Map([
  ["ysl", "YSL BEAUTY"], ["yves saint laurent", "YSL BEAUTY"], ["ysl beauty", "YSL BEAUTY"],
  ["mac", "MAC"], ["m a c", "MAC"], ["giorgio armani beauty", "ARMANI BEAUTY"], ["armani beauty", "ARMANI BEAUTY"],
  ["estee lauder", "ESTÉE LAUDER"], ["estée lauder", "ESTÉE LAUDER"], ["dior", "DIOR"], ["dior beauty", "DIOR"],
  ["chanel", "CHANEL"], ["nars", "NARS"], ["charlotte tilbury", "CHARLOTTE TILBURY"], ["hourglass", "HOURGLASS"]
]);

export function normalizeBrand(value) {
  const originalValue = clean(value);
  const token = normalizedToken(originalValue);
  return { originalValue, normalizedValue: BRAND_ALIASES.get(token) || originalValue.toUpperCase() };
}

function normalizeSource(source) {
  return {
    sourceID: source.id,
    source: source.name,
    sourceType: source.type,
    sourceURL: source.url || null,
    retrievedAt: source.retrievedAt,
    verifiedAt: source.verifiedAt,
    region: source.region,
    confidence: source.confidence,
    usagePermission: source.usagePermission
  };
}

function normalizeVariants(raw, productID, source) {
  const explicit = raw.variants || raw.shades;
  const items = Array.isArray(explicit) && explicit.length ? explicit : [{
    shadeName: raw.shadeName || raw.shade,
    shadeCode: raw.shadeCode,
    officialDescription: raw.shadeDescription,
    price: raw.price,
    currency: raw.currency,
    imageUrl: raw.imageUrl
  }];
  return items.map((item, index) => {
    const shadeName = clean(item.shadeName || item.name || item.shade || `Default ${index + 1}`);
    const shadeCode = clean(item.shadeCode || item.code);
    const color = {
      shadeName,
      shadeCode: shadeCode || null,
      officialDescription: clean(item.officialDescription || item.description) || null,
      mainHue: item.mainHue ?? raw.h ?? null,
      secondaryHue: item.secondaryHue ?? null,
      hueBias: item.hueBias ?? raw.tone ?? null,
      lightness: item.lightness ?? raw.l ?? null,
      saturation: item.saturation ?? raw.s ?? null,
      mutedness: item.mutedness ?? raw.muted ?? null,
      temperature: item.temperature ?? raw.tone ?? null,
      depth: item.depth ?? null,
      opacity: item.opacity ?? null,
      finish: unique([...(item.finish || []), ...normalizeFinishes(raw)]),
      computedColor: item.computedColor ?? (raw.h != null || raw.swatch != null),
      swatch: item.swatch || raw.swatch || null,
      swatchSource: item.swatchSource || (raw.swatch ? "legacy_manual_record" : null)
    };
    const variantID = stableId("var", productID, shadeCode || shadeName, source.region);
    const priceValue = Number(item.price ?? raw.price);
    const prices = Number.isFinite(priceValue) ? [{
      priceID: stableId("price", variantID, source.id, String(raw.priceDate || source.retrievedAt)),
      productID, variantID, retailer: source.name, region: source.region, currency: clean(item.currency || raw.currency || "CNY"),
      price: priceValue, salePrice: item.salePrice == null ? null : Number(item.salePrice), date: raw.priceDate || source.retrievedAt?.slice(0, 10),
      URL: item.productUrl || raw.productUrl || raw.source?.url || source.url || null, live: false
    }] : [];
    const variantImages = {
      officialPrimary: item.images?.officialPrimary || item.officialProductImage || null,
      officialSecondary: item.images?.officialSecondary || item.officialSecondary || [],
      officialSwatches: item.images?.officialSwatches || (item.officialSwatch ? [item.officialSwatch] : []),
      retailerImages: item.images?.retailerImages || item.retailerImages || [],
      userImages: item.images?.userImages || item.userImages || []
    };
    return { variantID, productID, shade: color, region: source.region, prices, images: variantImages, sources: [normalizeSource(source)] };
  });
}

function normalizePerformance(raw, source) {
  const entries = [];
  const push = (field, value, sourceType, confidence = source.confidence) => {
    if (value == null || value === "") return;
    entries.push({ field, value, sourceType, sourceID: source.id, confidence });
  };
  for (const [field, value] of Object.entries(raw.brandClaims || raw.claims || {})) push(field, value, "brand_claim");
  for (const [field, value] of Object.entries(raw.independentTests || {})) push(field, value, "independent_test");
  for (const [field, value] of Object.entries(raw.userExperience || {})) push(field, value, "user_experience");
  for (const [field, value] of Object.entries(raw.metrics || {})) push(field, value, "legacy_unverified", Math.min(source.confidence, 0.35));
  return entries;
}

export function normalizeEnvelope(envelope) {
  const raw = envelope.rawProduct || {};
  const source = {
    ...envelope.source,
    url: envelope.source.url || raw.productUrl || raw.source?.url || null,
    name: raw.source?.label || envelope.source.name
  };
  const brand = normalizeBrand(raw.brand);
  const name = clean(raw.name || raw.product_name || raw.productName);
  const productLine = clean(raw.productLine || raw.series || name);
  const taxonomy = mapTaxonomy(raw);
  const productID = stableId("prd", brand.normalizedValue, name, productLine);
  const ingredients = (Array.isArray(raw.ingredients) ? raw.ingredients : clean(raw.ingredients).split(/,|;|\|/)).map(clean).filter(Boolean);
  const sourceRecord = normalizeSource(source);
  const rawImages = raw.images || {};
  const genericPlaceholder = /product-packaging\.svg$/i.test(raw.img || "");
  const images = {
    officialPrimary: rawImages.officialPrimary || raw.officialProductImage || null,
    officialSecondary: rawImages.officialSecondary || raw.officialSecondary || [],
    officialSwatches: rawImages.officialSwatches || (raw.officialSwatch ? [raw.officialSwatch] : []),
    retailerImages: rawImages.retailerImages || raw.retailerImages || [],
    userImages: rawImages.userImages || raw.userImages || [],
    textureReference: rawImages.textureReference || (!genericPlaceholder && raw.img ? raw.img : null),
    simulatedImages: rawImages.simulatedImages || [],
    placeholder: rawImages.placeholder || "assets/images/product-packaging.svg"
  };
  if (raw.imageUrl) {
    const imageType = raw.imageType || "retailerImages";
    if (imageType === "officialProductImage" || imageType === "officialPrimary") images.officialPrimary ||= raw.imageUrl;
    else if (imageType === "userImage" || imageType === "userImages") images.userImages.push(raw.imageUrl);
    else images.retailerImages.push(raw.imageUrl);
  }
  const imageSources = (raw.imageSources || (raw.imageSource ? [raw.imageSource] : [])).map(item => ({
    type: item.type || "unknown", sourceName: item.sourceName || source.name, sourceUrl: item.sourceUrl || source.url || null,
    retrievedAt: item.retrievedAt || source.retrievedAt, usagePermission: item.usagePermission || source.usagePermission,
    cachedImage: item.cachedImage || null, originalImage: item.originalImage || item.url || null
  }));
  return {
    canonicalProductID: productID,
    brand,
    productLine: { originalValue: productLine, normalizedValue: normalizedToken(productLine) },
    name: { originalValue: name, normalizedValue: normalizedToken(name) },
    taxonomy,
    description: clean(raw.description || raw.officialDescription) || null,
    finish: normalizeFinishes(raw),
    coverage: clean(raw.coverage) || null,
    claims: Object.entries(raw.brandClaims || raw.claims || {}).map(([claim, value]) => ({ claim, value, sourceType: "brand_claim", sourceID: source.id })),
    performanceData: normalizePerformance(raw, source),
    ingredientLists: ingredients.length ? [{
      ingredientListID: stableId("inci", productID, source.id, ingredients.join("|")),
      formulaVersion: raw.formulaVersion || "unknown", ingredients, complete: raw.ingredientsComplete === true,
      sourceID: source.id, region: source.region, effectiveFrom: raw.formulaEffectiveFrom || null
    }] : [],
    variants: normalizeVariants(raw, productID, source),
    images,
    imageSources,
    sources: [sourceRecord],
    searchTags: unique([...(raw.colors || []), ...(raw.textures || []), ...(raw.attributeTags || []), ...(raw.skin || [])]),
    originalRecords: [{ sourceID: source.id, context: envelope.context, value: raw }],
    ui: {
      h: raw.h ?? null, s: raw.s ?? null, l: raw.l ?? null, muted: raw.muted ?? null, tone: raw.tone || "neutral",
      colors: raw.colors || [], textures: raw.textures || [], packaging: raw.packaging || [], skin: raw.skin || ["全部肤质"],
      metrics: raw.metrics || {}, downside: raw.downside || null, swatch: raw.swatch || null, scenes: raw.scenes || ["上课与日常", "通勤"]
    },
    conflicts: [],
    reviewFlags: taxonomy.category === "unknown" ? ["CATEGORY_UNMAPPED"] : []
  };
}

export const brandAliases = [...BRAND_ALIASES.entries()].map(([alias, normalized]) => ({ alias, normalized }));
