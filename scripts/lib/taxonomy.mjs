import { clean, normalizedToken } from "./text.mjs";

const records = [
  [["口红", "传统膏体口红", "lipstick", "lip color"], ["lips", "lip_color", "lipstick", "bullet"]],
  [["液体口红", "liquid lipstick", "liquid lip"], ["lips", "lip_color", "liquid_lipstick", "liquid"]],
  [["唇蜜", "lip gloss", "lipgloss", "gloss"], ["lips", "lip_color", "lip_gloss", "gloss"]],
  [["唇油", "lip oil"], ["lips", "lip_care", "lip_oil", "oil"]],
  [["有色润唇膏", "润唇产品", "lip balm", "tinted balm"], ["lips", "lip_care", "lip_balm", "balm"]],
  [["唇釉", "lip lacquer"], ["lips", "lip_color", "lip_lacquer", "liquid"]],
  [["眼影盘", "压盘粉状眼影", "eyeshadow palette"], ["eyes", "eyeshadow", "palette", "pressed_powder"]],
  [["单色眼影", "eyeshadow", "eye shadow"], ["eyes", "eyeshadow", "single", "powder"]],
  [["液体眼影", "liquid eyeshadow"], ["eyes", "eyeshadow", "single", "liquid"]],
  [["眼线笔", "眼线胶笔", "eyeliner", "eye pencil"], ["eyes", "eyeliner", "eyeliner", "pencil"]],
  [["睫毛膏", "mascara"], ["eyes", "mascara", "mascara", "liquid"]],
  [["腮红", "blush"], ["face", "blush", "blush", "unknown"]],
  [["修容", "contour"], ["face", "contour", "contour", "unknown"]],
  [["古铜", "bronzer"], ["face", "bronzer", "bronzer", "unknown"]],
  [["高光", "highlighter"], ["face", "highlighter", "highlighter", "unknown"]],
  [["粉底", "粉底液", "foundation"], ["complexion", "foundation", "foundation", "liquid"]],
  [["遮瑕", "遮瑕液", "concealer"], ["complexion", "concealer", "concealer", "liquid"]],
  [["定妆粉", "散粉", "powder"], ["complexion", "setting", "setting_powder", "loose_powder"]],
  [["定妆喷雾", "setting spray"], ["complexion", "setting", "setting_spray", "spray"]],
  [["眉部", "brow"], ["eyes", "brow", "brow", "unknown"]],
  [["刷具", "brush"], ["tools", "brush", "brush", "tool"]]
];

const aliases = new Map();
for (const [names, taxonomy] of records) for (const name of names) aliases.set(normalizedToken(name), taxonomy);

const display = {
  lips: "唇部彩妆", eyes: "眼部彩妆", face: "面部彩妆", complexion: "底妆", tools: "美妆工具", unknown: "未分类",
  lip_color: "口红", lip_care: "润唇产品", eyeshadow: "眼影", eyeliner: "眼线", mascara: "睫毛膏", blush: "腮红",
  contour: "修容", bronzer: "古铜", highlighter: "高光", foundation: "粉底", concealer: "遮瑕", setting: "定妆", brow: "眉部", brush: "刷具"
};

export const FINISH_ALIASES = new Map(Object.entries({
  "matte": "matte", "哑光": "matte", "完全哑光": "matte", "soft matte": "soft_matte", "柔雾": "soft_matte",
  "satin": "satin", "缎光": "satin", "shimmer": "shimmer", "珠光": "shimmer", "metallic": "metallic", "金属": "metallic",
  "glossy": "glossy", "高光泽": "glossy", "natural glow": "natural_glow", "自然光泽": "natural_glow", "自然皮肤光泽": "natural_glow"
}).map(([key, value]) => [normalizedToken(key), value]));

export function mapTaxonomy(raw = {}) {
  const candidates = [raw.format, raw.form, raw.subcategory, raw.productType, raw.category, raw.major].map(clean).filter(Boolean);
  let found;
  for (const candidate of candidates) {
    const token = normalizedToken(candidate);
    found = aliases.get(token) || [...aliases.entries()].find(([alias]) => token.includes(alias) || alias.includes(token))?.[1];
    if (found) break;
  }
  const [department, category, subcategory, inferredFormat] = found || ["unknown", "unknown", "unknown", "unknown"];
  const explicitFormat = normalizedToken(raw.format || raw.form || "");
  return {
    department,
    category,
    subcategory,
    format: explicitFormat ? explicitFormat.replace(/\s+/g, "_") : inferredFormat,
    formulaType: normalizedToken(raw.formulaType || "") || "unknown",
    displayDepartment: display[department] || department,
    displayCategory: display[category] || clean(raw.category) || category,
    original: { department: clean(raw.major || raw.department), category: clean(raw.category), subcategory: clean(raw.subcategory), format: clean(raw.format || raw.form) }
  };
}

export function normalizeFinishes(raw = {}) {
  const values = [...(Array.isArray(raw.finish) ? raw.finish : raw.finish ? [raw.finish] : []), ...(raw.textures || []), ...(raw.attributeTags || [])];
  return [...new Set(values.map(value => FINISH_ALIASES.get(normalizedToken(value))).filter(Boolean))];
}

export const categoryDictionary = records.map(([names, value]) => ({ aliases: names, department: value[0], category: value[1], subcategory: value[2], format: value[3] }));
