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

## Pipelab

The plugin only ever **checks** `pipelab._isInitialized`. It never initialises Pipelab itself,
because doing so would race the user's own `beforeprojectstart` handler.

Initialise Pipelab from `runOnStartup`, which Construct pushes into its load promises and awaits on
the loading screen:

```js
runOnStartup(async (runtime) => {
  await runtime.objects.Pipelab.getFirstInstance()._Initialize();
});
```

Do **not** use `beforeprojectstart` for this (as Under The Red Sky's `scripts/main.js:83` does) — it
runs alongside the save load, not before it.

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

| Folder property | Pipelab | Webview (File System) | Node.js (NW.js) |
|---|---|---|---|
| App data | `_appDataFolder` | `<roaming-app-data>` | `%APPDATA%` / `~/Library/Application Support` / `$XDG_CONFIG_HOME` |
| Home | `_homeFolder` | `<profile>` | `os.homedir()` |
| App folder | `_exeFolder` | `<app>` | `dirname(process.execPath)` |

Documents and Saved games are deliberately absent: Pipelab exposes no `savedGames` path at all
(its `userData` is `appData/<appName>`, which is a different location), and NW.js has no reliable
Documents API — localized folder names and OneDrive redirection both break the naive
`homedir() + "/Documents"` guess.

**Webview requires Construct's File System plugin in the project.** The native
`scirra-filesystem.ext.*` binary is only bundled into an export when that plugin is present, so the
dependency cannot be avoided.

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
