import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";

async function loadRuntime() {
  const sandbox = { window: {}, encodeURIComponent, structuredClone };
  vm.createContext(sandbox);
  for (const file of ["js/makeup-image-prompt-builder.js", "js/image-generation/provider.js", "js/image-generation/validator.js"]) {
    vm.runInContext(await fs.readFile(new URL(`../${file}`, import.meta.url), "utf8"), sandbox, { filename: file });
  }
  return sandbox.window;
}

function plan(overrides = {}) {
  return {
    schemaVersion: "1.0", lookId: "look_test", style: "editorial", intensity: 2, scene: "studio", composition: "controlled",
    skin: { finish: "natural_satin", coverage: "light_medium", powder: "minimal", setting: "minimal" },
    eyes: { primaryColor: { name: "cool taupe", hexApprox: "#827a78" }, secondaryColor: { name: "muted violet grey", hexApprox: "#706873" }, finish: "soft_shimmer", shape: "elongated_soft_wing", placement: { lid: "cool taupe", outerCorner: "muted violet grey", crease: "soft", lowerLashLine: "cool taupe", direction: "outward and upward" }, liner: { enabled: true, color: "charcoal", shape: "thin_extended" } },
    cheeks: { color: "muted cool rose", hexApprox: "#b98e91", finish: "natural", opacity: "light", placement: "high_horizontal" },
    lips: { color: "light muted greige nude", hexApprox: "#b49a91", bias: "slightly cool", depth: "medium-high lightness", saturation: "low", finish: "satin_balm", opacity: "medium", edge: "natural", application: "thin" },
    products: [], lighting: "soft_daylight", referenceFace: null, avoid: ["purple-pink lipstick", "warm orange tones", "large glitter particles", "heavy black smoky eye"], locks: {},
    ...overrides
  };
}

test("A: color, placement, finish and negative constraints reach the generation prompt", async () => {
  const runtime = await loadRuntime(), built = runtime.SEVB_MAKEUP_PROMPT_BUILDER.buildMakeupImagePrompt(plan());
  assert.match(built.prompt, /cool taupe/);
  assert.match(built.prompt, /muted violet grey/);
  assert.match(built.prompt, /high_horizontal/);
  assert.match(built.prompt, /satin_balm/);
  assert.match(built.negativePrompt, /purple-pink lipstick/);
  assert.match(built.negativePrompt, /warm orange tones/);
  assert.match(built.negativePrompt, /large glitter particles/);
});

test("B: strict collection plan contains only The Rock Chick colors and product", async () => {
  const runtime = await loadRuntime(), rock = { id: "rock", brand: "Charlotte Tilbury", name: "Luxury Palette", shade: "The Rock Chick", color: "cool grey and silver grey", approximateColor: "#6e7075", finish: "matte and shimmer" }, source = plan({ products: [rock] });
  const built = runtime.SEVB_MAKEUP_PROMPT_BUILDER.buildMakeupImagePrompt(source, {}, source.products);
  assert.equal(built.imageSpecification.products.length, 1);
  assert.match(built.prompt, /The Rock Chick/);
  assert.doesNotMatch(built.prompt, /blue|green|orange eye/i);
});

test("C: liquid blush dewy sheer properties survive specification conversion", async () => {
  const runtime = await loadRuntime(), source = plan({ cheeks: { color: "muted rose", hexApprox: "#bd7779", finish: "dewy liquid", opacity: "sheer", placement: "high_horizontal" } });
  const built = runtime.SEVB_MAKEUP_PROMPT_BUILDER.buildMakeupImagePrompt(source);
  assert.match(built.prompt, /dewy liquid/);
  assert.match(built.prompt, /sheer application/);
  assert.equal(built.imageSpecification.makeup.cheeks.opacity, "sheer");
});

test("D: intensity changes the bound diagram while product colors remain unchanged", async () => {
  const runtime = await loadRuntime(), low = runtime.SEVB_MAKEUP_PROMPT_BUILDER.buildImageSpecification(plan({ intensity: 1 })), high = runtime.SEVB_MAKEUP_PROMPT_BUILDER.buildImageSpecification(plan({ intensity: 5 }));
  const lowResult = await runtime.SEVB_MAKEUP_IMAGE_PROVIDER.generateMakeupImage({ imageSpecification: low }), highResult = await runtime.SEVB_MAKEUP_IMAGE_PROVIDER.generateMakeupImage({ imageSpecification: high });
  assert.notEqual(lowResult.masterImage, highResult.masterImage);
  assert.equal(low.makeup.eyes.primaryColor.hexApprox, high.makeup.eyes.primaryColor.hexApprox);
  assert.equal(low.makeup.lips.hexApprox, high.makeup.lips.hexApprox);
});

test("E: lighting variants are derived from one master and no vision score is fabricated", async () => {
  const runtime = await loadRuntime(), source = plan(), spec = runtime.SEVB_MAKEUP_PROMPT_BUILDER.buildImageSpecification(source), result = await runtime.SEVB_MAKEUP_IMAGE_PROVIDER.generateMakeupImage({ imageSpecification: spec });
  assert.match(spec.lighting.variantRule, /same master image/);
  assert.equal(result.status, "IMAGE_SERVICE_UNAVAILABLE");
  const validation = await runtime.SEVB_MAKEUP_IMAGE_VALIDATOR.validateGeneratedImage({ makeupPlan: source, imageSpecification: spec, generationResult: result });
  assert.equal(validation.visualStatus, "NOT_AUTOMATICALLY_VERIFIED");
  assert.equal(validation.visualScores, null);
});
