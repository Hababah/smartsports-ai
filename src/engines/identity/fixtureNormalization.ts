
export interface NormalizedName {
  original: string;
  normalized: string;
  tokens: string[];
}

export interface NameNormalizationPolicy {
  removeCommonClubSuffixes: boolean;
}

export const DEFAULT_NAME_NORMALIZATION_POLICY: NameNormalizationPolicy = {
  removeCommonClubSuffixes: false,
};

const UNICODE_MARKS = /[\u0300-\u036f]/g;
const NON_ALPHANUMERIC = /[^a-z0-9]+/g;

export function normalizeEntityName(
  value: string,
  policy: NameNormalizationPolicy = DEFAULT_NAME_NORMALIZATION_POLICY,
): NormalizedName {
  if (typeof value !== "string") {
    throw new TypeError("Entity name must be a string.");
  }

  const original = value;
  let normalized = value
    .normalize("NFKD")
    .replace(UNICODE_MARKS, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(NON_ALPHANUMERIC, " ")
    .trim()
    .replace(/\s+/g, " ");

  if (policy.removeCommonClubSuffixes) {
    normalized = normalized.replace(
      /\b(fc|cf|afc|sc|club)\b/g,
      "",
    ).replace(/\s+/g, " ").trim();
  }

  return {
    original,
    normalized,
    tokens: normalized ? normalized.split(" ") : [],
  };
}

export function areNormalizedNamesEqual(
  first: string,
  second: string,
  policy: NameNormalizationPolicy = DEFAULT_NAME_NORMALIZATION_POLICY,
): boolean {
  const normalizedFirst = normalizeEntityName(first, policy);
  const normalizedSecond = normalizeEntityName(second, policy);

  return normalizedFirst.normalized.length > 0 &&
    normalizedFirst.normalized === normalizedSecond.normalized;
}
