import { findObjectClassByPluginId, joinFromRoot, appContainerFolder } from "../paths.js";

export const id = "pipelab";

const PLUGIN_ID = "pipelabv2";
const FOLDER_FIELDS = {
  appdata: "_appDataFolder",
  home: "_homeFolder",
  appfolder: "_exeFolder",
};

export function getInstance(ctx) {
  const oc = findObjectClassByPluginId(ctx.runtime, PLUGIN_ID);
  return oc ? oc.getFirstInstance() : null;
}

// Deliberately a check and never an init. Pipelab is single global, so it exists
// during runOnStartup, which Construct awaits on the loading screen - meaning a
// user side runOnStartup init is always finished before our auto load runs.
// Initialising it ourselves here would instead race other beforeprojectstart
// listeners, which Construct fires concurrently.
export function isAvailable(ctx) {
  const pl = getInstance(ctx);
  return !!(pl && pl._isInitialized);
}

export function unavailableReason() {
  return (
    "Pipelab is not initialised. Initialise it during startup so it is ready before auto load:\n" +
    "  runOnStartup(async runtime => {\n" +
    "    await runtime.objects.Pipelab.getFirstInstance()._Initialize();\n" +
    "  });\n" +
    "It must be runOnStartup, not beforeprojectstart, which runs concurrently with Save Manager."
  );
}

// Electron's `exe` is MyApp.app/Contents/MacOS/MyApp on macOS, so _exeFolder
// points inside the bundle exactly like NW.js's execPath does. Normalise it the
// same way so both backends agree on what App folder means.
export function getFolderRoot(pl, folder) {
  const raw = pl ? pl[FOLDER_FIELDS[folder]] : "";
  if (!raw) return "";
  return folder === "appfolder" ? appContainerFolder(raw) : raw;
}

function resolvePaths(ctx) {
  const pl = getInstance(ctx);
  const root = getFolderRoot(pl, ctx.folder);
  if (!root) throw new Error(`Pipelab did not report a path for folder "${ctx.folder}"`);
  const file = joinFromRoot(root, ctx.subfolder, ctx.fileName);
  return {
    pl,
    dir: joinFromRoot(root, ctx.subfolder),
    file,
    tmp: `${file}.tmp`,
  };
}

export async function read(ctx) {
  const { pl, file } = resolvePaths(ctx);
  await pl._ReadTextFile(file);
  const result = pl._ReadTextFileResult();
  // Pipelab returns the file contents on success and boolean false on failure,
  // so this has to be an identity check. Testing for falsiness would misread a
  // legitimately empty save file as "no save".
  if (result === false || result === null || result === undefined) return null;
  return String(result);
}

// Atomic where possible: write a sibling temp file, then move it over the target.
// _MoveFile takes an explicit overwrite flag, so replacing the destination is
// defined behaviour rather than something we have to hope for. If the move fails
// for any reason we fall back to writing in place, so a bad move can never break
// saving outright.
export async function write(ctx, text) {
  const { pl, dir, file, tmp } = resolvePaths(ctx);
  await pl._CreateFolder(dir, true);

  await pl._WriteTextFile(tmp, text);
  if (pl._WriteTextFileResult()) {
    await pl._MoveFile(tmp, file, true);
    if (pl._MoveFileResult()) return;
    // Clean up so a stale temp file is not left next to the save.
    try {
      await pl._DeleteFile(tmp, false);
    } catch (e) {
      // Best effort only.
    }
  }

  await pl._WriteTextFile(file, text);
  if (!pl._WriteTextFileResult())
    throw new Error(pl._WriteTextFileError() || "Pipelab could not write the save file");
}

// Host-side copy over the Pipelab socket, so it does not route through our read
// and can still succeed when reading failed.
export async function copy(ctx, destCtx) {
  const { pl, file } = resolvePaths(ctx);
  const dest = resolvePaths(destCtx);
  await pl._CopyFile(file, dest.file, true);
  if (!pl._CopyFileResult())
    throw new Error(pl._CopyFileError() || "Pipelab could not copy the save file");
}

export async function remove(ctx) {
  const { pl, file } = resolvePaths(ctx);
  await pl._DeleteFile(file, false);
  if (!pl._DeleteFileResult()) {
    const err = pl._DeleteFileError();
    if (err) throw new Error(err);
  }
}

export async function exists(ctx) {
  const { pl, file } = resolvePaths(ctx);
  await pl._CheckIfPathExist(file);
  return !!pl._CheckIfPathExistResult();
}
