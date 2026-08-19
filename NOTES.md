# Save Manager — implementation notes

## Why the load happens in `beforeprojectstart`

Instances of a plugin with `IsSingleGlobal: false` are created by
`_CreateGlobalNonWorlds()` inside `Runtime.Start()` — which runs *after* Construct has awaited
`_additionalLoadPromises`. So `runtime.sdk.addLoadPromise()` is not available to us; by the time our
constructor runs, that array has already been cleared. (The Dedra SDK Wrapper can use it only
because it is single global, and single global instances are created back in the `ObjectClass`
constructor.)

`beforeprojectstart` blocks just as hard. `layout._StartRunning` awaits
`DispatchUserScriptEventAsyncWait`, which reaches `_FireAndWait_AsyncOptional` — that collects every
listener's returned Promise and `Promise.all`s them. Returning a Promise there stalls startup
exactly like a load promise would, and by that point our instance, the JSON object, and Pipelab all
exist. The only visible difference is that Construct has already called `EndLoadingScreen()`, so a
slow backend shows a blank canvas rather than the loading bar.

**Consequence:** those listeners run *concurrently*, not in sequence. Anything the save load depends
on must be ready **before** `beforeprojectstart`, not during it.

## Pipelab, and the beforeLoad hook

The plugin only ever **checks** `pipelab._isInitialized`. It never initialises Pipelab itself,
because that would race the user's own setup code.

Initialising from your own `beforeprojectstart` handler does **not** work, even when the listener is
registered in `runOnStartup`. Construct fires all `beforeprojectstart` listeners first and only then
awaits them together (`_FireAndWait_AsyncOptional` in `lib/events/handler.js`), so your
`_Initialize()` and the auto load start at the same instant and race.

Register the setup with the plugin instead. It is awaited before any backend is resolved, on every
load, save, delete and check:

```js
globalThis.SaveManager.beforeLoad(async (runtime) => {
  await runtime.objects.Pipelab.getFirstInstance()._Initialize();
});
```

Register it from an imported script or inside `runOnStartup` — anywhere that runs before the loading
screen ends. Hooks run once, in registration order, and every Save Manager instance shares the same
single setup pass. A hook that throws is logged and skipped rather than wedging startup; the backend
check that follows reports the real consequence.

Registering a hook after loading has already begun logs a warning and does nothing, because by then
it is too late to matter.

## Custom backend

Register from a script with the *Imported script* purpose so it is in place before the loading
screen ends. Set the instance's **Custom handler ID** property to the registered name.

```js
globalThis.SaveManager.register("cloud", {
  async save(name, text) { await fetch("/api/save", { method: "POST", body: text }); },
  async load(name) {
    const r = await fetch("/api/save");
    return r.ok ? await r.text() : null;   // null means "no save exists"
  },
  async delete(name) { ... },   // optional, required only for the Delete save action
  async exists(name) { ... },   // optional, falls back to load() !== null
});
```

`name` is the resolved file name, e.g. `PlayerSave.sav`.

## Backends and folders

Every folder option resolves to the **shared** root on all three backends; the Subfolder property
(default: project name) is what scopes it to your game. One rule, and the app name never nests twice.

### App data (default)

| Platform | Webview (File System) | Pipelab (`_appDataFolder`) | Node.js (NW.js) |
|---|---|---|---|
| Windows | `<roaming-app-data>` = `%APPDATA%` | `%APPDATA%` | `%APPDATA%` |
| macOS | `<local-app-data>` = `~/Library/Application Support` | `~/Library/Application Support` | `~/Library/Application Support` |
| Linux | `<local-app-data>` = `$XDG_DATA_HOME` or `~/.local/share` | `$XDG_CONFIG_HOME` or `~/.config` | `$XDG_CONFIG_HOME` or `~/.config` |

Windows and macOS agree exactly across all three backends. **Linux is the one divergence**:
Construct's native extension uses the XDG *data* dir, while Electron — and therefore Pipelab — uses
the XDG *config* dir. That is baked into the two frameworks and cannot be reconciled. It only matters
if a shipped game switches backends.

`<roaming-app-data>` is kept as the first candidate on purpose. On Windows, Roaming (`%APPDATA%`) is
the conventional home for user data meant to follow the user between machines, and it is exactly what
Electron's `app.getPath("appData")` returns — so keeping it makes Webview agree with Pipelab and
NW.js on Windows. It simply does not exist on macOS or Linux, which is what the fallback is for.

`<current-app-data>` is deliberately **not** used. It is already app-scoped — on macOS it is
`~/Library/Application Support/<bundle-id>` — so combined with the Subfolder property it produces a
doubly-nested path like `~/Library/Application Support/com.my.game/MyGame/Save.sav`.

### Home

`<profile>` / `_homeFolder` / `os.homedir()` — the user's home directory, identical everywhere.

### App folder

`<app>` / `_exeFolder` / `dirname(process.execPath)` — the install directory. Fine for portable
Windows builds, but treat it as read-only on macOS (it lives inside the `.app` bundle, and macOS
translocates quarantined apps onto a read-only mount) and under `Program Files` on Windows.

Documents and Saved games are excluded: Pipelab exposes no `savedGames` path at all, and NW.js has no
reliable Documents API — localized folder names and OneDrive redirection both break the naive
`homedir() + "/Documents"` guess.

### How these were established

Construct's manual blocks scripted access, so the macOS and Linux rows come from the binaries and
from experiment, not from docs:

- The macOS `scirra-filesystem.ext.dylib` exports `GetMacOSKnownFolderPath(NSSearchPathDirectory)`
  and advertises exactly `<app> <current-app-data> <desktop> <documents> <downloads>
  <local-app-data> <pictures> <profile> <videos> <web-resource>` — no `<roaming-app-data>`, no
  `<saved-games>`.
- `<local-app-data>` and `<current-app-data>` were pinned down on a real WKWebView export by planting
  marker save files in candidate directories and observing which one the runtime loaded.
- The Linux `.so` exports `GetXDGDataHomePath()` and `GetXDGPathFromUserDirs()`, and references
  `XDG_DATA_HOME`, `~/.local/share` and `~/.config/user-dirs.dirs`.
- Electron's `app.getPath()` documentation covers the Pipelab column.

**The Windows rows are inferred from Electron's documented behaviour and Windows convention — they
have not been verified on Windows hardware.**

### Two requirements for Webview

**It needs Construct's File System plugin in the project.** The native `scirra-filesystem.ext.*`
binary is only bundled into an export when that plugin is present, so the dependency is unavoidable.

**It needs a Construct version whose File System plugin ships the `IFileSystemObjectType` scripting
interface.** On older exports that class is absent entirely, `runtime.objects.FileSystem` is a plain
object type with no file methods at all, and the backend correctly reports itself unavailable.

Auto resolution order: Pipelab (a free boolean check, never a probe) → Webview → Node.js → Local
storage.

## Behaviour worth knowing

- **File name** is `<ObjectTypeName>.<extension>`, so two Save Manager instances can never collide —
  Construct already guarantees object type names are unique. The same string is the local storage
  key, so behaviour is consistent across backends.
- **Merge** is a deep merge of the stored save over the defaults. Nested objects merge key by key;
  everything else, arrays included, is replaced wholesale by the save. That is what lets a game
  update add new keys to `defaults.json` and have old saves pick them up, without defaults leaking
  back into a deliberately emptied inventory array.
- **An empty file is a real save, not a missing one.** Backends return `null` for "no save" and
  `""` for an empty file. An empty or corrupt file therefore reports `Has save data` as **true** and
  fires `On error` — it does not silently masquerade as a fresh start, which would let a
  "no save → new game" flow overwrite a recoverable file.
- **An explicitly selected backend never falls back.** If Method is Pipelab and Pipelab is
  unreachable, load and save both fire `On error` rather than quietly using local storage. Silent
  fallback is how a momentarily unavailable backend turns into a stale save file and an apparently
  wiped player profile. Auto still walks its ladder normally.
- **Slots** are plumbed through every internal method (`_doLoad(slot)`, `_resolveName(slot)` → 
  `PlayerSave_slot2.sav`) but no ACE exposes them yet. Adding them later is purely additive.

## Property order is load bearing

`_getInitProperties()` returns values positionally, so new properties must be **appended**, never
inserted. Avoid `group`/`link`/`info` property types — whether they consume a runtime slot is
inconsistent between the framework's validation and observed behaviour.
