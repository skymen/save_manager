// IndexedDB backed key/value store, namespaced per project by Construct.
// Always available, including in private browsing where Construct silently
// falls back to an in-memory store.
export const id = "localstorage";

export function isAvailable() {
  return true;
}

export async function read(ctx) {
  const value = await ctx.runtime.storage.getItem(ctx.key);
  return value === null || value === undefined ? null : String(value);
}

export async function write(ctx, text) {
  await ctx.runtime.storage.setItem(ctx.key, text);
}

export async function remove(ctx) {
  await ctx.runtime.storage.removeItem(ctx.key);
}

export async function exists(ctx) {
  return (await read(ctx)) !== null;
}
