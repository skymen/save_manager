import { joinFromRoot } from "../paths.js";

export const id = "nodejs";

// Reached through globalThis so bundlers do not try to resolve it, and so this
// module stays importable on the web where require() does not exist.
function req(name) {
  const r = globalThis.require;
  if (typeof r !== "function") throw new Error("require() is not available");
  return r(name);
}

export function isAvailable() {
  return !!globalThis.nw && typeof globalThis.require === "function";
}

export function unavailableReason() {
  return "Not running under NW.js, so require('fs') is unavailable.";
}

// Construct's own NW.js plugin only exposes the exe folder and the home folder,
// and is hard disabled from r497 anyway. Since we call require('fs') directly we
// can resolve app data the same way Electron does, which keeps this backend
// aligned with the Pipelab and File System folder options.
function rootFolder(ctx) {
  const os = req("os");
  const path = req("path");
  const platform = globalThis.process.platform;

  switch (ctx.folder) {
    case "home":
      return os.homedir();
    case "appfolder":
      return path.dirname(globalThis.process.execPath);
    case "appdata":
    default:
      if (platform === "win32")
        return globalThis.process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
      if (platform === "darwin")
        return path.join(os.homedir(), "Library", "Application Support");
      return globalThis.process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  }
}

function resolvePaths(ctx) {
  const root = rootFolder(ctx);
  return {
    fs: req("fs"),
    dir: joinFromRoot(root, ctx.subfolder),
    file: joinFromRoot(root, ctx.subfolder, ctx.fileName),
  };
}

export async function read(ctx) {
  const { fs, file } = resolvePaths(ctx);
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, { encoding: "utf8" });
}

export async function write(ctx, text) {
  const { fs, dir, file } = resolvePaths(ctx);
  if (dir) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, text, { encoding: "utf8" });
}

export async function remove(ctx) {
  const { fs, file } = resolvePaths(ctx);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

export async function exists(ctx) {
  const { fs, file } = resolvePaths(ctx);
  return fs.existsSync(file);
}
