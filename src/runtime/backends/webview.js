import { findObjectClassByPluginId, joinPath } from "../paths.js";

export const id = "webview";

const PLUGIN_ID = "FileSystem";

// Picker tags are NOT uniform across platforms, so each folder option is a
// priority list and the first tag the platform actually reports wins.
//
// "App data" deliberately resolves to the SHARED app-data root, not to an
// app-scoped folder, because the Subfolder property is what does the app
// scoping. Verified on macOS by planting marker files and observing which one
// the runtime loaded:
//
//   <roaming-app-data>   Windows %APPDATA%            (absent on macOS/Linux)
//   <local-app-data>     macOS ~/Library/Application Support   [verified]
//                        Linux $XDG_DATA_HOME or ~/.local/share
//   <current-app-data>   NOT used: it is already app-scoped, so it would nest
//                        twice, e.g. .../com.my.game/MyGame/Save.sav
//                        (macOS: ~/Library/Application Support/<bundle-id>) [verified]
//
// The chosen roots line up with Electron's app.getPath("appData"), which is what
// Pipelab reports as _appDataFolder, on Windows and macOS.
const PICKER_TAGS = {
  appdata: ["<roaming-app-data>", "<local-app-data>"],
  home: ["<profile>"],
  appfolder: ["<app>"],
};

// The full set Construct knows about, used only to report what IS supported when a
// lookup fails.
const ALL_TAGS = [
  "<app>", "<web-resource>", "<current-app-data>", "<local-app-data>",
  "<roaming-app-data>", "<desktop>", "<documents>", "<downloads>",
  "<pictures>", "<profile>", "<saved-games>", "<screenshots>", "<videos>",
];

// The File System plugin exposes no path API whatsoever: GetFullPath exists only
// as an internal symbol inside scirra-filesystem.ext.*, and the File System Access
// API deliberately never reveals real paths. The folder *shape* is knowable from
// platformInfo.os though, so build a path using the platform's own environment
// token for the part we cannot know - the user's home directory. These paste
// straight into Explorer or Finder's "Go to Folder" and resolve.
const FOLDER_TOKENS = {
  windows: {
    "<roaming-app-data>": "%APPDATA%",
    "<local-app-data>": "%LOCALAPPDATA%",
    "<profile>": "%USERPROFILE%",
  },
  macos: {
    "<local-app-data>": "~/Library/Application Support",
    "<profile>": "~",
  },
  linux: {
    "<local-app-data>": "~/.local/share",
    "<profile>": "~",
  },
};

// The absolute path is genuinely unobtainable here, so this is the closest honest
// answer. <app> has no token because the install directory is not derivable, and
// falls back to the picker tag itself.
export function fullPath(ctx) {
  const tag = pickerTag(ctx);
  if (tag === null) return "";

  const os = (ctx.runtime.platformInfo && ctx.runtime.platformInfo.os) || "";
  const root = (FOLDER_TOKENS[os] || {})[tag] || tag;
  const sep = os === "windows" ? "\\" : "/";

  return [root, ctx.subfolder, ctx.fileName]
    .filter((part) => part !== "" && part !== null && part !== undefined)
    .join(sep);
}

// Opens the save's folder in the OS file manager. Only available on desktop
// wrapper exports; in a browser there is nothing to open.
export async function reveal(ctx) {
  const fs = getType(ctx);
  const tag = requireTag(ctx);
  if (!fs.desktopFeaturesSupported)
    throw new Error("Revealing the save location is only supported on desktop exports.");
  await fs.shellOpen(tag, ctx.subfolder);
}

// The File System plugin exposes its API on the object type, not an instance.
export function getType(ctx) {
  return findObjectClassByPluginId(ctx.runtime, PLUGIN_ID);
}

// hasPickerTag is the platform-accurate check on every platform. On Windows the
// set is built from the directory handles the wrapper actually hands over; on
// macOS and Linux it comes from the native extension's own init response.
function pickerTag(ctx) {
  const fs = getType(ctx);
  if (!fs || typeof fs.hasPickerTag !== "function") return null;
  for (const tag of PICKER_TAGS[ctx.folder] || []) {
    if (fs.hasPickerTag(tag)) return tag;
  }
  return null;
}

function requireTag(ctx) {
  const tag = pickerTag(ctx);
  if (tag === null) throw new Error(unavailableReason(ctx));
  return tag;
}

function supportedTags(ctx) {
  const fs = getType(ctx);
  if (!fs || typeof fs.hasPickerTag !== "function") return [];
  return ALL_TAGS.filter((t) => fs.hasPickerTag(t));
}

// Construct only bundles the native scirra-filesystem extension when the File
// System plugin is present in the project, so that dependency is unavoidable.
export function isAvailable(ctx) {
  const fs = getType(ctx);
  if (!fs || !fs.isSupported) return false;
  return pickerTag(ctx) !== null;
}

export function unavailableReason(ctx) {
  const fs = getType(ctx);
  if (!fs)
    return (
      "No File System object is in the project. Add Construct's File System plugin - the " +
      "native extension it ships is what provides desktop file access."
    );
  if (!fs.isSupported)
    return "The File System object reports that it is not supported on this platform.";

  const supported = supportedTags(ctx);
  return (
    `This platform supports none of the folders mapped to "${ctx.folder}" ` +
    `(${(PICKER_TAGS[ctx.folder] || []).join(", ")}). ` +
    `Folders it does support: ${supported.length ? supported.join(", ") : "none"}.`
  );
}

export async function read(ctx) {
  // Check first rather than catching a throw, so a genuine IO failure is not
  // silently reported as "no save exists".
  if (!(await exists(ctx))) return null;
  const fs = getType(ctx);
  const data = await fs.readFile({
    pickerTag: requireTag(ctx),
    folderPath: ctx.relPath,
    mode: "text",
  });
  return typeof data === "string" ? data : null;
}

export async function write(ctx, text) {
  const fs = getType(ctx);
  const tag = requireTag(ctx);
  if (ctx.subfolder) {
    try {
      await fs.createFolder(tag, ctx.subfolder);
    } catch (e) {
      // Already exists is the normal case and is not distinguishable here.
    }
  }
  await fs.writeFile({
    pickerTag: tag,
    folderPath: ctx.relPath,
    data: text,
    mode: "overwrite",
  });
}

// Copy runs on the native/FS-Access side rather than through readFile, so it can
// still succeed when our own read failed. The write path is deliberately left
// alone: createWritable() already commits via a swap file, so it is atomic, and
// move() is flagged outside OPFS with inconsistent overwrite semantics.
export async function copy(ctx, destCtx) {
  const fs = getType(ctx);
  const tag = requireTag(ctx);
  await fs.copyFile(tag, ctx.relPath, destCtx.relPath);
}

export async function remove(ctx) {
  const fs = getType(ctx);
  const tag = requireTag(ctx);
  if (!(await exists(ctx))) return;
  await fs.delete(tag, ctx.relPath, false);
}

export async function exists(ctx) {
  const fs = getType(ctx);
  const tag = pickerTag(ctx);
  if (tag === null) return false;
  try {
    const content = await fs.listContent(tag, ctx.subfolder, false);
    const files = (content && content.files) || [];
    return files.some((f) => joinPath(f) === joinPath(ctx.fileName) || f === ctx.relPath);
  } catch (e) {
    // The subfolder does not exist yet, so neither does the save.
    return false;
  }
}
