import * as localstorage from "./localstorage.js";
import * as nodejs from "./nodejs.js";
import * as webview from "./webview.js";
import * as pipelab from "./pipelab.js";
import * as custom from "./custom.js";

export const BACKENDS = { localstorage, nodejs, webview, pipelab, custom };

// Order matters. Pipelab first because a project that ships it is a desktop
// build, and the check is a free boolean read rather than a probe. Local storage
// is last because it always reports available.
export const AUTO_ORDER = ["webview", "nodejs", "pipelab", "localstorage"];

export function resolveAuto(ctx) {
  for (const name of AUTO_ORDER) {
    try {
      if (BACKENDS[name].isAvailable(ctx)) return BACKENDS[name];
    } catch (e) {
      // A backend that throws while probing is simply not available.
    }
  }
  return localstorage;
}
