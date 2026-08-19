// Backends disagree about trailing slashes, so every join goes through here.
export function joinPath(...parts) {
  return parts
    .filter((p) => p !== null && p !== undefined && p !== "")
    .map((p) => String(p).replace(/[\\/]+$/, "").replace(/^[\\/]+/, ""))
    .filter((p) => p !== "")
    .join("/");
}

// Same as joinPath but keeps a leading "/" or a "C:\" style drive prefix intact.
export function joinFromRoot(root, ...parts) {
  const base = String(root ?? "").replace(/[\\/]+$/, "");
  const rest = joinPath(...parts);
  if (!base) return rest;
  return rest ? `${base}/${rest}` : base;
}

// Strip anything that is illegal in a file name on any of the target platforms.
export function sanitizeSegment(name) {
  return String(name ?? "")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/^\.+/, "")
    .trim();
}

export function findObjectClassByPluginId(runtime, pluginId) {
  const objects = runtime.objects;
  if (!objects) return null;
  for (const key of Object.keys(objects)) {
    const oc = objects[key];
    if (oc && oc.plugin && oc.plugin.id === pluginId) return oc;
  }
  return null;
}
