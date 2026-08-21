import registry from "../registry.js";

export const id = "custom";

function handler(ctx) {
  const h = registry.get(ctx.handlerId);
  if (!h) throw new Error(`No custom handler registered under "${ctx.handlerId}"`);
  return h;
}

export function isAvailable(ctx) {
  return !!ctx.handlerId && registry.has(ctx.handlerId);
}

export function unavailableReason(ctx) {
  if (!ctx.handlerId)
    return "Method is Custom but the Custom handler ID property is empty.";
  return (
    `No custom handler registered under "${ctx.handlerId}". Register one from an imported ` +
    "script so it exists before the loading screen ends:\n" +
    `  globalThis.SaveManager.register("${ctx.handlerId}", {\n` +
    "    async save(name, text) { ... },\n" +
    "    async load(name) { return text; },   // return null when there is no save\n" +
    "    async delete(name) { ... },          // optional\n" +
    "  });"
  );
}

export async function read(ctx) {
  const result = await handler(ctx).load(ctx.fileName);
  return result === null || result === undefined ? null : String(result);
}

export async function write(ctx, text) {
  await handler(ctx).save(ctx.fileName, text);
}

export async function remove(ctx) {
  const h = handler(ctx);
  if (typeof h.delete !== "function")
    throw new Error(`Custom handler "${ctx.handlerId}" does not implement delete()`);
  await h.delete(ctx.fileName);
}

// Optional. A local handler can open a folder, a cloud one can open a URL - what
// "the save's location" means is the handler's decision.
export async function reveal(ctx) {
  const h = handler(ctx);
  if (typeof h.reveal !== "function")
    throw new Error(`Custom handler "${ctx.handlerId}" does not implement reveal()`);
  await h.reveal(ctx.fileName);
}

export async function exists(ctx) {
  const h = handler(ctx);
  if (typeof h.exists === "function") return !!(await h.exists(ctx.fileName));
  return (await read(ctx)) !== null;
}
