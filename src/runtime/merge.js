export function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

// Deep merge `override` on top of `base`. Plain objects are merged key by key;
// everything else, arrays included, is replaced wholesale by the override. This
// is what lets a game add new keys to its default save file and have old saves
// pick them up, without defaults leaking back into e.g. a deliberately emptied
// inventory array.
export function deepMerge(base, override) {
  if (override === undefined) return base;
  if (!isPlainObject(base) || !isPlainObject(override)) return override;

  const out = { ...base };
  for (const key of Object.keys(override)) {
    const next = override[key];
    out[key] =
      isPlainObject(next) && isPlainObject(base[key])
        ? deepMerge(base[key], next)
        : next;
  }
  return out;
}
