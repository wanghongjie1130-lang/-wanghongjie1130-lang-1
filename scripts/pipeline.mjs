import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getAdapter } from "../data-sources/registry.mjs";
import { normalizeEnvelope, brandAliases } from "./lib/normalize.mjs";
import { deduplicate } from "./lib/deduplicate.mjs";
import { validateProduct } from "./lib/validate.mjs";
import { categoryDictionary } from "./lib/taxonomy.mjs";
import { normalizedToken, stableId, unique } from "./lib/text.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, "imports/import-manifest.json");
const outputDir = path.join(root, "data");
const generatedBundle = path.join(root, "js/generated-products.js");
const readJson = async file => JSON.parse(await fs.readFile(file, "utf8"));
const writeJson = async (file, value) => { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, JSON.stringify(value, null, 2) + "\n"); };

function sourceKey(source) { return `${source.sourceID}|${source.sourceURL || ""}|${source.region}`; }

function ingredientDictionary(products) {
  const map = new Map();
  for (const product of products) for (const list of product.ingredientLists) for (const inciName of list.ingredients) {
    const key = normalizedToken(inciName);
    if (!map.has(key)) map.set(key, {
      ingredientID: stableId("ing", key), inciName, commonName: null, aliases: [], function: null,
      possibleSensitivityNotes: null, sources: [list.sourceID]
    });
    else map.get(key).sources = unique([...map.get(key).sources, list.sourceID]);
  }
  return [...map.values()];
}

function latestPrice(product) {
  return product.variants.flatMap(variant => variant.prices).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0] || null;
}

function productImage(product, variant = product.variants[0]) {
  const candidates = [
    [variant?.images?.officialPrimary, "OFFICIAL PRODUCT IMAGE", "official"],
    [product.images.officialPrimary, "OFFICIAL PRODUCT IMAGE", "official"],
    [variant?.images?.retailerImages?.[0], "RETAILER PRODUCT IMAGE", "retailer"],
    [product.images.retailerImages[0], "RETAILER PRODUCT IMAGE", "retailer"],
    [variant?.images?.userImages?.[0], "USER PHOTO", "user"],
    [product.images.userImages[0], "USER PHOTO", "user"],
    [product.images.placeholder, "PRODUCT PLACEHOLDER", "placeholder"]
  ];
  const selected = candidates.find(([url]) => Boolean(url)) || ["assets/images/product-packaging.svg", "PRODUCT PLACEHOLDER", "placeholder"];
  return { url: selected[0], label: selected[1], type: selected[2] };
}

function flattenImages(product) {
  const rows = [];
  const add = (type, url, variantID = null) => { if (url) rows.push({ imageID: stableId("img", product.canonicalProductID, variantID || "product", type, url), productID: product.canonicalProductID, variantID, type, url, sources: product.imageSources }); };
  add("OFFICIAL PRODUCT IMAGE", product.images.officialPrimary);
  product.images.officialSecondary.forEach(url => add("OFFICIAL PRODUCT IMAGE", url));
  product.images.officialSwatches.forEach(url => add("OFFICIAL SWATCH", url));
  product.images.retailerImages.forEach(url => add("RETAILER PRODUCT IMAGE", url));
  product.images.userImages.forEach(url => add("USER PHOTO", url));
  add("TEXTURE REFERENCE", product.images.textureReference);
  product.images.simulatedImages.forEach(url => add("SIMULATED IMAGE", url));
  for (const variant of product.variants) {
    add("OFFICIAL PRODUCT IMAGE", variant.images.officialPrimary, variant.variantID);
    variant.images.officialSecondary.forEach(url => add("OFFICIAL PRODUCT IMAGE", url, variant.variantID));
    variant.images.officialSwatches.forEach(url => add("OFFICIAL SWATCH", url, variant.variantID));
    variant.images.retailerImages.forEach(url => add("RETAILER PRODUCT IMAGE", url, variant.variantID));
    variant.images.userImages.forEach(url => add("USER PHOTO", url, variant.variantID));
  }
  return rows;
}

function toIndex(product) {
  const prices = product.variants.flatMap(variant => variant.prices).map(price => price.price).filter(Number.isFinite);
  const raw = product.originalRecords[0]?.value || {};
  const image = productImage(product);
  return {
    id: product.canonicalProductID,
    brand: product.brand.originalValue,
    normalizedBrand: product.brand.normalizedValue,
    name: product.name.originalValue,
    productLine: product.productLine.originalValue,
    department: product.taxonomy.department,
    category: product.taxonomy.category,
    subcategory: product.taxonomy.subcategory,
    format: product.taxonomy.format,
    finishes: product.finish,
    shades: product.variants.map(variant => ({ id: variant.variantID, name: variant.shade.shadeName, code: variant.shade.shadeCode })),
    thumbnail: image.url,
    imageType: image.label,
    imageFallbackType: image.type,
    imageOptions: product.images,
    priceMin: prices.length ? Math.min(...prices) : null,
    priceMax: prices.length ? Math.max(...prices) : null,
    currency: latestPrice(product)?.currency || null,
    status: product.status,
    dataCompleteness: product.dataCompleteness.score,
    basicFilterData: {
      searchTags: product.searchTags,
      ingredients: product.ingredientLists.flatMap(list => list.ingredients),
      performanceFields: unique(product.performanceData.map(item => item.field)),
      skin: raw.skin || [],
      tone: raw.tone || null
    },
    detailPath: `data/products/${product.canonicalProductID}.json`
  };
}

function toLegacy(product) {
  const raw = product.originalRecords[0]?.value || {};
  const variant = product.variants[0];
  const price = latestPrice(product);
  const metric = product.ui.metrics || {};
  const evidence = field => product.performanceData.find(item => item.field === field || item.field === ({ wear: "持妆", oxidation: "氧化", transfer: "转移", comfort: "滋润" }[field]));
  const performance = {
    wear: { value: metric.持妆 ?? null, hours: null, source: evidence("wear")?.sourceType || "资料不足", confidence: evidence("wear")?.confidence ?? "unknown" },
    oxidation: { value: metric.氧化 ?? null, source: evidence("oxidation")?.sourceType || "资料不足", confidence: evidence("oxidation")?.confidence ?? "unknown" },
    film: { value: null, source: "资料不足", confidence: "unknown" },
    transfer: { value: metric.转移 == null ? null : 5 - metric.转移, source: evidence("transfer")?.sourceType || "资料不足", confidence: evidence("transfer")?.confidence ?? "unknown" },
    layering: { value: null, source: "资料不足", confidence: "unknown" },
    comfort: { value: metric.滋润 ?? metric.粉质 ?? null, source: evidence("comfort")?.sourceType || "资料不足", confidence: evidence("comfort")?.confidence ?? "unknown" },
    beginner: null,
    finish: product.finish,
    glitter: product.finish.filter(value => /shimmer|glitter|metallic/.test(value)),
    completeness: product.dataCompleteness.score
  };
  const image = productImage(product, variant);
  return {
    id: product.canonicalProductID,
    brand: product.brand.originalValue,
    name: product.name.originalValue,
    series: product.productLine.originalValue,
    shade: variant?.shade.shadeName || "",
    major: raw.major || product.taxonomy.displayDepartment,
    category: raw.category || product.taxonomy.displayCategory,
    productType: raw.productType || product.taxonomy.displayCategory,
    form: raw.form || raw.category || product.taxonomy.format,
    price: price?.price ?? null,
    currency: price?.currency || "CNY",
    priceDate: price?.date || null,
    h: product.ui.h, s: product.ui.s, l: product.ui.l, muted: product.ui.muted, tone: product.ui.tone,
    colors: product.ui.colors, textures: product.ui.textures, packaging: product.ui.packaging, skin: product.ui.skin,
    metrics: product.ui.metrics, scenes: product.ui.scenes, downside: product.ui.downside,
    swatch: product.ui.swatch || variant?.shade.swatch || "#b7aaa5",
    img: image.url,
    imageType: image.label,
    imageFallbackType: image.type,
    images: product.images,
    imageSources: product.imageSources,
    ingredients: product.ingredientLists[0]?.ingredients || [],
    ingredientStatus: product.ingredientLists[0]?.complete ? "完整成分表" : "成分资料不足",
    finish: product.finish,
    attributeTags: product.finish,
    performance,
    source: {
      label: product.sources[0]?.source || "来源待核实",
      url: product.sources[0]?.sourceURL || "",
      verified: product.status.label,
      retrievedAt: product.sources[0]?.retrievedAt,
      region: product.sources[0]?.region,
      confidence: product.sources[0]?.confidence
    },
    dataCompleteness: product.dataCompleteness.score,
    dataStatus: product.status.label,
    demo: false,
    value: raw.value || 3
  };
}

async function main() {
  const manifest = await readJson(manifestPath);
  const envelopes = [], importHistory = [], importErrors = [];
  for (const entry of manifest.imports || []) {
    const config = { ...entry, input: entry.input ? path.resolve(root, entry.input) : null };
    const startedAt = new Date().toISOString();
    try {
      const imported = await getAdapter(config).import(config);
      envelopes.push(...imported);
      importHistory.push({ adapter: entry.adapter, source: imported[0]?.source?.name || entry.input, date: startedAt, itemsFound: imported.length, itemsAdded: imported.length, itemsUpdated: 0, duplicates: 0, errors: 0, status: "SUCCESS" });
    } catch (error) {
      importErrors.push({ adapter: entry.adapter, input: entry.input, code: /supported/i.test(error.message) ? "UNSUPPORTED_SOURCE" : "IMPORT_FAILED", message: error.message });
      importHistory.push({ adapter: entry.adapter, source: entry.input, date: startedAt, itemsFound: 0, itemsAdded: 0, itemsUpdated: 0, duplicates: 0, errors: 1, status: "FAILED" });
    }
  }

  const normalized = envelopes.map(normalizeEnvelope);
  const deduped = deduplicate(normalized);
  if (importHistory[0]) importHistory[0].duplicates = deduped.duplicates.length;
  const validations = deduped.products.map(product => validateProduct(product));
  const products = validations.filter(result => result.valid).map(result => result.product);
  for (const result of validations.filter(result => !result.valid)) importErrors.push({ productID: result.product.canonicalProductID, code: "VALIDATION_FAILED", errors: result.errors });

  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(path.join(outputDir, "products"), { recursive: true });
  for (const product of products) await writeJson(path.join(outputDir, "products", `${product.canonicalProductID}.json`), product);

  const index = products.map(toIndex);
  const sources = [...new Map(products.flatMap(product => product.sources).map(source => [sourceKey(source), source])).values()];
  const brands = [...new Map(products.map(product => [product.brand.normalizedValue, {
    brandID: stableId("brand", product.brand.normalizedValue), name: product.brand.originalValue,
    normalizedName: product.brand.normalizedValue, aliases: brandAliases.filter(alias => alias.normalized === product.brand.normalizedValue).map(alias => alias.alias)
  }])).values()];
  const variants = products.flatMap(product => product.variants.map(variant => ({ ...variant, prices: undefined })));
  const prices = products.flatMap(product => product.variants.flatMap(variant => variant.prices));
  const formulas = products.flatMap(product => product.ingredientLists);
  const ingredients = ingredientDictionary(products);
  const claims = products.flatMap(product => product.claims.map(claim => ({ productID: product.canonicalProductID, ...claim })));
  const performance = products.flatMap(product => product.performanceData.map(item => ({ productID: product.canonicalProductID, ...item })));
  const images = products.flatMap(flattenImages);
  const conflicts = products.flatMap(product => product.conflicts.map(conflict => ({ productID: product.canonicalProductID, ...conflict })));
  const missing = validations.flatMap(result => result.warnings.map(warning => ({ productID: result.product.canonicalProductID, product: `${result.product.brand.originalValue} ${result.product.name.originalValue}`, ...warning })));
  const dashboard = {
    generatedAt: new Date().toISOString(), products: products.length, brands: brands.length, variants: variants.length,
    shades: variants.filter(variant => variant.shade.shadeName).length,
    completeIngredients: formulas.filter(list => list.complete).length,
    withPriceData: products.filter(product => product.variants.some(variant => variant.prices.length)).length,
    sources: sources.length, duplicates: deduped.duplicates.length, conflicts: conflicts.length,
    needsReview: products.filter(product => product.status.code === "NEEDS_REVIEW").length,
    dataIncomplete: products.filter(product => product.status.code === "DATA_INCOMPLETE").length,
    images: {
      official: products.filter(product => product.images.officialPrimary || product.variants.some(variant => variant.images.officialPrimary)).length,
      missingOfficial: products.filter(product => !product.images.officialPrimary && !product.variants.some(variant => variant.images.officialPrimary)).length,
      retailerFallback: products.filter(product => !product.images.officialPrimary && product.images.retailerImages.length).length,
      userFallback: products.filter(product => !product.images.officialPrimary && !product.images.retailerImages.length && product.images.userImages.length).length,
      placeholder: products.filter(product => productImage(product).type === "placeholder").length
    }
  };
  const search = index.map(product => ({ id: product.id, tokens: unique([
    product.brand, product.normalizedBrand, product.name, product.productLine, product.department, product.category,
    product.subcategory, product.format, ...product.finishes, ...product.shades.flatMap(shade => [shade.name, shade.code]),
    ...product.basicFilterData.searchTags, ...product.basicFilterData.ingredients
  ].map(normalizedToken).filter(Boolean)) }));

  await Promise.all([
    writeJson(path.join(outputDir, "products-index.json"), index), writeJson(path.join(outputDir, "brands.json"), brands),
    writeJson(path.join(outputDir, "categories.json"), categoryDictionary), writeJson(path.join(outputDir, "variants.json"), variants),
    writeJson(path.join(outputDir, "ingredients.json"), ingredients), writeJson(path.join(outputDir, "ingredient-lists.json"), formulas),
    writeJson(path.join(outputDir, "prices.json"), prices), writeJson(path.join(outputDir, "sources.json"), sources),
    writeJson(path.join(outputDir, "claims.json"), claims), writeJson(path.join(outputDir, "performance.json"), performance),
    writeJson(path.join(outputDir, "images.json"), images), writeJson(path.join(outputDir, "duplicates.json"), deduped.duplicates),
    writeJson(path.join(outputDir, "conflicts.json"), conflicts), writeJson(path.join(outputDir, "missing-data.json"), missing),
    writeJson(path.join(outputDir, "import-history.json"), importHistory), writeJson(path.join(outputDir, "import-errors.json"), importErrors),
    writeJson(path.join(outputDir, "search-index.json"), search), writeJson(path.join(outputDir, "dashboard.json"), dashboard)
  ]);

  const legacy = products.map(toLegacy);
  await fs.writeFile(generatedBundle, `/* Generated by scripts/pipeline.mjs. Do not edit manually. */\nwindow.BEAUTY_PRODUCTS_GENERATED=${JSON.stringify(legacy, null, 2)};\n`);
  console.log(JSON.stringify({ ...dashboard, imported: envelopes.length, valid: products.length, errors: importErrors.length }, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
