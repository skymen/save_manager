import { findObjectClassByPluginId, joinPath } from "../paths.js";

export const id = "webview";

const PLUGIN_ID = "FileSystem";
const PICKER_TAGS = {
  appdata: "<roaming-app-data>",
  home: "<profile>",
  appfolder: "<app>",
};

// The File System plugin exposes its API on the object type, not an instance.
export function getType(ctx) {
  return findObjectClassByPluginId(ctx.runtime, PLUGIN_ID);
}

function pickerTag(ctx) {
  return PICKER_TAGS[ctx.folder];
}

// Construct only bundles the native scirra-filesystem extension when the File
// System plugin is present in the project, so this dependency is unavoidable.
export function isAvailable(ctx) {
  const fs = getType(ctx);
  if (!fs || !fs.isSupported) return false;
  const tag = pickerTag(ctx);
  return typeof fs.hasPickerTag === "function" ? fs.hasPickerTag(tag) : true;
}

export function unavailableReason() {
  return (
    "The File System object is missing or unsupported on this platform. Add Construct's " +
    "File System plugin to the project."
  );
}

export async function read(ctx) {
  // Check first rather than catching a throw, so a genuine IO failure is not
  // silently reported as "no save exists".
  if (!(await exists(ctx))) return null;
  const fs = getType(ctx);
  const data = await fs.readFile({
    pickerTag: pickerTag(ctx),
    folderPath: ctx.relPath,
    mode: "text",
  });
  return typeof data === "string" ? data : null;
}

export async function write(ctx, text) {
  const fs = getType(ctx);
  if (ctx.subfolder) {
    try {
      await fs.createFolder(pickerTag(ctx), ctx.subfolder);
    } catch (e) {
      // Already exists is the normal case and is not distinguishable here.
    }
  }
  await fs.writeFile({
    pickerTag: pickerTag(ctx),
    folderPath: ctx.relPath,
    data: text,
    mode: "overwrite",
  });
}

export async function remove(ctx) {
  const fs = getType(ctx);
  if (!(await exists(ctx))) return;
  await fs.delete(pickerTag(ctx), ctx.relPath, false);
}

export async function exists(ctx) {
  const fs = getType(ctx);
  try {
    const content = await fs.listContent(pickerTag(ctx), ctx.subfolder, false);
    const files = (content && content.files) || [];
    return files.some(
      (f) => joinPath(f) === joinPath(ctx.fileName) || f === ctx.relPath,
    );
  } catch (e) {
    // The subfolder does not exist yet, so neither does the save.
    return false;
  }
}
