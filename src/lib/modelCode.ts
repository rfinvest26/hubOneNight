/** Flexible model-code parsing for input copied from ads and Telegram posts. */
export function compactModelCode(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKC')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function modelCodeCandidates(value: unknown): string[] {
  const raw = String(value ?? '').normalize('NFKC').toUpperCase();
  const compact = compactModelCode(raw);
  const candidates = new Set<string>();
  if (compact) candidates.add(compact);

  // Normal pasted form: ON-RM5L, ON RM5L, ON_RM5L, etc.
  for (const match of raw.matchAll(/(?:^|[^A-Z0-9])ON[\s_\-–—.:/]*([A-Z0-9]{4,12})(?=$|[^A-Z0-9])/g)) {
    candidates.add(`ON${match[1]}`);
    candidates.add(match[1]!);
  }

  // Handles text such as "onenight ON RM 5L" after separators are removed.
  const lastOn = compact.lastIndexOf('ON');
  if (lastOn >= 0) {
    const fromOn = compact.slice(lastOn);
    if (/^ON[A-Z0-9]{4,12}$/.test(fromOn)) {
      candidates.add(fromOn);
      candidates.add(fromOn.slice(2));
    }
  }

  for (const token of raw.split(/[^A-Z0-9]+/).filter(Boolean)) {
    if (/^[A-Z0-9]{4,12}$/.test(token)) candidates.add(token);
  }
  if (compact.startsWith('ON') && compact.length > 2) candidates.add(compact.slice(2));
  return [...candidates];
}

/** Returns the canonical route/DB form only when the input clearly looks like a code. */
export function canonicalModelCode(value: unknown): string | null {
  const raw = String(value ?? '').normalize('NFKC').toUpperCase();
  const compact = compactModelCode(raw);
  const lastOn = compact.lastIndexOf('ON');
  if (lastOn >= 0) {
    const fromOn = compact.slice(lastOn);
    if (/^ON[A-Z0-9]{4,12}$/.test(fromOn)) return `ON-${fromOn.slice(2)}`;
  }
  if (/^[A-Z0-9]{4,12}$/.test(compact) && /\d/.test(compact)) return `ON-${compact}`;
  return null;
}

export function findModelByFlexibleCode<T extends { code?: string | null }>(models: T[], input: unknown): T | null {
  const query = new Set(modelCodeCandidates(input));
  if (!query.size) return null;
  return models.find((model) => {
    const compact = compactModelCode(model.code);
    const suffix = compact.startsWith('ON') ? compact.slice(2) : compact;
    return query.has(compact) || query.has(suffix);
  }) ?? null;
}
