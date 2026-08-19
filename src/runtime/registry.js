// Global registry for user supplied save/load implementations. This module runs
// at import time, before the loading screen ends, so an imported user script can
// call SaveManager.register() and still be in place for auto load.
function createRegistry() {
  const handlers = new Map();
  return {
    register(name, handler) {
      if (typeof name !== "string" || name === "")
        throw new Error("[Save Manager] register() needs a non-empty name");
      if (!handler || typeof handler.save !== "function" || typeof handler.load !== "function")
        throw new Error(
          `[Save Manager] handler "${name}" must provide async save(name, text) and load(name) functions`
        );
      handlers.set(name, handler);
    },
    unregister(name) {
      handlers.delete(name);
    },
    get(name) {
      return handlers.get(name) || null;
    },
    has(name) {
      return handlers.has(name);
    },
    list() {
      return [...handlers.keys()];
    },
  };
}

if (!globalThis.SaveManager) globalThis.SaveManager = createRegistry();

export default globalThis.SaveManager;
