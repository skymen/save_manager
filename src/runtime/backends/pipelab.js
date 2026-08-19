import { findObjectClassByPluginId, joinFromRoot } from "../paths.js";

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

function resolvePaths(ctx) {
  const pl = getInstance(ctx);
  const root = pl ? pl[FOLDER_FIELDS[ctx.folder]] : "";
  if (!root) throw new Error(`Pipelab did not report a path for folder "${ctx.folder}"`);
  return {
    pl,
    dir: joinFromRoot(root, ctx.subfolder),
    file: joinFromRoot(root, ctx.subfolder, ctx.fileName),
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

export async function write(ctx, text) {
  const { pl, dir, file } = resolvePaths(ctx);
  await pl._CreateFolder(dir, true);
  await pl._WriteTextFile(file, text);
  if (!pl._WriteTextFileResult())
    throw new Error(pl._WriteTextFileError() || "Pipelab could not write the save file");
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
