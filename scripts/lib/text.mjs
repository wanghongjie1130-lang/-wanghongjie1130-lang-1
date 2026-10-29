import crypto from "node:crypto";

export function clean(value) {
  return value == null ? "" : String(value).replace(/\s+/g, " ").trim();
}

export function normalizedToken(value) {
  return clean(value)
    .normalize("NFKD")
    .replace(/[’'·.®™]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLowerCase();
}

export function slug(value) {
  return normalizedToken(value).replace(/\s+/g, "-") || "unknown";
}

export function stableId(prefix, ...parts) {
  const hash = crypto.createHash("sha1").update(parts.map(normalizedToken).join("|")).digest("hex").slice(0, 14);
  return `${prefix}_${hash}`;
}

export function unique(values) {
  return [...new Set(values.filter(value => value != null && value !== ""))];
}

export function levenshtein(a, b) {
  const left = normalizedToken(a), right = normalizedToken(b);
  const matrix = Array.from({ length: right.length + 1 }, (_, y) => [y]);
  for (let x = 0; x <= left.length; x += 1) matrix[0][x] = x;
  for (let y = 1; y <= right.length; y += 1) {
    for (let x = 1; x <= left.length; x += 1) {
      matrix[y][x] = right[y - 1] === left[x - 1]
        ? matrix[y - 1][x - 1]
        : Math.min(matrix[y - 1][x - 1], matrix[y][x - 1], matrix[y - 1][x]) + 1;
    }
  }
  return matrix[right.length][left.length];
}

export function similarity(a, b) {
  const max = Math.max(normalizedToken(a).length, normalizedToken(b).length, 1);
  return 1 - levenshtein(a, b) / max;
}
