import { joinFromRoot, appContainerFolder } from "../paths.js";

export const id = "nodejs";

// Reached through globalThis so bundlers do not try to resolve it, and so this
// module stays importable on the web where require() does not exist.
function req(name) {
  const r = globalThis.require;
  if (typeof r !== "function") throw new Error("require() is not available");
  return r(name);
}

// NW.js exposes process on globalThis in the renderer, but Construct's own NW.js
// plugin read it as `self.process || nw.process`, so keep the same fallback.
function nodeProcess() {
  return globalThis.process || (globalThis.nw && globalThis.nw.process) || null;
}

// A capability check rather than a proxy for one: confirm the promises API we
// actually call is present, instead of inferring it from `nw` being defined.
export function isAvailable() {
  if (typeof globalThis.require !== "function") return false;
  if (!nodeProcess()) return false;
  try {
    const fsp = req("fs").promises;
    return !!(fsp && typeof fsp.writeFile === "function" && typeof fsp.rename === "function");
  } catch (e) {
    return false;
  }
}

export function unavailableReason() {
  if (typeof globalThis.require !== "function")
    return "Not running under NW.js, so require('fs') is unavailable.";
  return "require('fs') is present but does not expose the fs.promises API this backend needs.";
}

// Construct's own NW.js plugin only exposes the exe folder and the home folder,
// and is hard disabled from r497 anyway. Since we call require('fs') directly we
// can resolve app data the same way Electron does, which keeps this backend
// aligned with the Pipelab and File System folder options.
// "App folder" means the folder the app lives in, not somewhere inside it.
// Verified on a real NW.js export: the runtime runs in the renderer process, so
// execPath points at
//   .../SaveManagerTest.app/Contents/Frameworks/nwjs Framework.framework/
//       Versions/<ver>/Helpers/nwjs Helper (Renderer).app/Contents/MacOS/...
// Taking dirname of that would drop saves inside the framework, keyed to a
// Chromium version. appContainerFolder walks back out to the folder holding the
// outermost .app, and is a no-op on Windows and Linux.
function appFolder(path, proc) {
  return appContainerFolder(path.dirname(proc.execPath));
}

function rootFolder(ctx) {
  const os = req("os");
  const path = req("path");
  const proc = nodeProcess();
  if (!proc) throw new Error("NW.js process object is unavailable");
  const platform = proc.platform;
  const env = proc.env || {};

  switch (ctx.folder) {
    case "home":
      return os.homedir();
    case "appfolder":
      return appFolder(path, proc);
    case "appdata":
    default:
      if (platform === "win32")
        return env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
      if (platform === "darwin")
        return path.join(os.homedir(), "Library", "Application Support");
      return env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  }
}

function resolvePaths(ctx) {
  const root = rootFolder(ctx);
  const file = joinFromRoot(root, ctx.subfolder, ctx.fileName);
  return {
    fsp: req("fs").promises,
    dir: joinFromRoot(root, ctx.subfolder),
    file,
    tmp: `${file}.tmp`,
  };
}

// Read straight away and treat ENOENT as "no save", rather than testing for
// existence first: one syscall instead of two, and no window between the check
// and the read in which the file could disappear.
// The absolute path on disk, for display or logging.
export function fullPath(ctx) {
  const { file } = resolvePaths(ctx);
  return file;
}

// showItemInFolder opens the containing folder and highlights the file, which is
// what you want for a save: a .sav has no useful default application.
export async function reveal(ctx) {
  const shell = globalThis.nw && globalThis.nw.Shell;
  if (!shell || typeof shell.showItemInFolder !== "function")
    throw new Error("nw.Shell is unavailable, so the save location cannot be revealed");
  const { file } = resolvePaths(ctx);
  shell.showItemInFolder(file);
}

export async function read(ctx) {
  const { fsp, file } = resolvePaths(ctx);
  try {
    return await fsp.readFile(file, { encoding: "utf8" });
  } catch (e) {
    if (e && e.code === "ENOENT") return null;
    throw e;
  }
}

// Atomic: write a sibling temp file, then rename over the target. Renaming within
// a directory replaces the destination atomically on POSIX, and libuv uses
// MOVEFILE_REPLACE_EXISTING on Windows, so a crash can never leave a truncated
// save the way writeFileSync's open-with-"w" could.
export async function write(ctx, text) {
  const { fsp, dir, file, tmp } = resolvePaths(ctx);
  if (dir) await fsp.mkdir(dir, { recursive: true });
  await fsp.writeFile(tmp, text, { encoding: "utf8" });
  try {
    await fsp.rename(tmp, file);
  } catch (e) {
    // Leave no stray temp file behind if the rename could not complete.
    try {
      await fsp.unlink(tmp);
    } catch (e2) {
      // Nothing useful to do; the rename error is the one that matters.
    }
    throw e;
  }
}

// A distinct syscall that does not route through read(), so it can still succeed
// when our own read failed.
export async function copy(ctx, destCtx) {
  const src = resolvePaths(ctx);
  const dest = resolvePaths(destCtx);
  if (dest.dir) await src.fsp.mkdir(dest.dir, { recursive: true });
  await src.fsp.copyFile(src.file, dest.file);
}

export async function remove(ctx) {
  const { fsp, file } = resolvePaths(ctx);
  try {
    await fsp.unlink(file);
  } catch (e) {
    // Already gone is success as far as the caller is concerned.
    if (!e || e.code !== "ENOENT") throw e;
  }
}

export async function exists(ctx) {
  const { fsp, file } = resolvePaths(ctx);
  try {
    await fsp.access(file);
    return true;
  } catch (e) {
    return false;
  }
}
