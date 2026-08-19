// Global registry for user supplied save/load implementations. This module runs
// at import time, before the loading screen ends, so an imported user script can
// call SaveManager.register() and still be in place for auto load.
function createRegistry() {
  const handlers = new Map();
  const hooks = [];
  let readyPromise = null;

  return {
    // Anything the save backends depend on must be ready BEFORE the save loads.
    // Construct fires beforeprojectstart listeners concurrently, so doing setup
    // in your own beforeprojectstart handler races the auto load rather than
    // preceding it. Register it here instead and the plugin will await it.
    beforeLoad(fn) {
      if (typeof fn !== "function")
        throw new Error("[Save Manager] beforeLoad() expects a function");
      if (readyPromise)
        console.warn(
          "[Save Manager] beforeLoad() was called after loading already began, so this hook " +
            "will not run in time. Register it from an imported script or runOnStartup."
        );
      hooks.push(fn);
    },

    // Runs every hook once, in registration order, and hands back the same
    // promise afterwards so multiple Save Manager instances share one setup pass.
    whenReady(runtime) {
      if (!readyPromise) {
        readyPromise = (async () => {
          for (const fn of hooks) {
            try {
              await fn(runtime);
            } catch (e) {
              // A broken hook must not wedge startup; the backend check that
              // follows will report the real consequence.
              console.error("[Save Manager] a beforeLoad hook threw:", e);
            }
          }
        })();
      }
      return readyPromise;
    },

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
