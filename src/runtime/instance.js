import { id, addonType } from "../../config.caw.js";
import AddonTypeMap from "../../template/addonTypeMap.js";
import { deepMerge, isPlainObject } from "./merge.js";
import {
  joinPath,
  joinFromRoot,
  sanitizeSegment,
  findObjectClassByPluginId,
} from "./paths.js";
import { BACKENDS, resolveAuto } from "./backends/index.js";
import registry from "./registry.js";

const METHODS = [
  "auto",
  "localstorage",
  "nodejs",
  "webview",
  "pipelab",
  "custom",
];
const FOLDERS = ["appdata", "home", "appfolder"];

// Every operation that can fail gets its own trigger alongside On any error, so a
// project can react to "couldn't read" differently from "couldn't write" without
// substring-matching the message.
const ERROR_TRIGGERS = {
  load: "OnLoadError",
  save: "OnSaveError",
  delete: "OnDeleteError",
  check: "OnCheckError",
  new: "OnNewSaveError",
};

export default function (parentClass) {
  return class extends parentClass {
    constructor() {
      super();

      this._backend = "";
      this._isLoaded = false;
      this._saveExisted = false;
      this._lastError = "";
      this._lastErrorOperation = "";
      this._onBeforeProjectStart = null;
      // One promise chain per instance. Every operation goes through it, so a save
      // can never interleave with a load or with another save - an invariant that
      // otherwise leaks out and has to be re-implemented by every project.
      this._queue = Promise.resolve();
      this._queuedSave = null;
      // Project files cannot change at runtime, so the default data is fetched
      // exactly once at startup and cached. That is what lets New save be sync.
      this._defaults = null;
      this._defaultsReady = false;
      this._defaultsError = "";

      const properties = this._getInitProperties();
      if (properties) {
        this._autoLoad = !!properties[0];
        this._methodIndex = properties[1] | 0;
        this._jsonSid = properties[2];
        this._defaultDataPath = properties[3] || "";
        this._saveName = String(properties[4] ?? "");
        this._extension = String(properties[5] ?? "sav").replace(/^\.+/, "");
        this._folderIndex = properties[6] | 0;
        this._subfolder = String(properties[7] ?? "");
        this._customHandlerId = String(properties[8] ?? "");
      } else {
        this._autoLoad = false;
        this._methodIndex = 0;
        this._jsonSid = -1;
        this._defaultDataPath = "";
        this._saveName = "";
        this._extension = "sav";
        this._folderIndex = 0;
        this._subfolder = "";
        this._customHandlerId = "";
      }

      // Instances of a non single global plugin are created inside Runtime.Start(),
      // after Construct has already awaited its load promises, so addLoadPromise is
      // not an option for us. beforeprojectstart is the next hook and blocks just as
      // hard: Construct collects each listener's returned promise and awaits them all
      // before the first layout starts.
      //
      // Registered unconditionally, not just for auto load, so the default data is
      // always cached before any event sheet runs.
      this._onBeforeProjectStart = () => this._onProjectStart();
      this.runtime.addEventListener(
        "beforeprojectstart",
        this._onBeforeProjectStart,
      );
    }

    async _onProjectStart() {
      await this._loadDefaults();
      this._warnOnNameCollision();
      if (this._autoLoad) await this._doLoad();
    }

    // Unique object type names used to guarantee two instances could never share a
    // file. Setting Save name removes that guarantee, so check for it once at
    // startup. A warning only: two instances pointed at one file is almost always a
    // mistake, but it is not this plugin's place to refuse to run.
    _warnOnNameCollision() {
      const oc = findObjectClassByPluginId(this.runtime, id);
      if (!oc) return;

      const mine = this._buildContext("");
      for (const other of oc.getAllInstances()) {
        if (other === this || typeof other._buildContext !== "function") continue;
        const theirs = other._buildContext("");
        if (
          theirs.fileName === mine.fileName &&
          theirs.subfolder === mine.subfolder &&
          theirs.folder === mine.folder
        ) {
          console.warn(
            `[Save Manager: ${this.objectType.name}] Another Save Manager ` +
              `("${other.objectType.name}") resolves to the same save "${mine.fileName}" in the ` +
              `same folder. They will overwrite each other. Give them different Save names.`
          );
          return;
        }
      }
    }

    // ---------------------------------------------------------------- naming

    // Falls back to the object type name when Save name is blank. That default is
    // convenient but invisible: renaming the object in the editor then changes the
    // file name and hides existing saves, which is why Save name exists.
    _resolveName(slot) {
      const base = sanitizeSegment(this._saveName || this.objectType.name);
      const suffix = slot ? `_${sanitizeSegment(slot)}` : "";
      const ext = sanitizeSegment(this._extension);
      return ext ? `${base}${suffix}.${ext}` : `${base}${suffix}`;
    }

    _resolveSubfolder() {
      return sanitizeSegment(this._subfolder || this.runtime.projectName || "");
    }

    _buildContext(slot = "") {
      const fileName = this._resolveName(slot);
      const subfolder = this._resolveSubfolder();
      return {
        runtime: this.runtime,
        inst: this,
        folder: FOLDERS[this._folderIndex] || "appdata",
        subfolder,
        fileName,
        relPath: joinPath(subfolder, fileName),
        key: fileName,
        handlerId: this._customHandlerId,
      };
    }

    // A single backup slot alongside the save, overwritten whenever a new backup
    // is needed. Derived from the live context so slots come along for free.
    _toBackupContext(ctx) {
      return {
        ...ctx,
        fileName: `${ctx.fileName}.bak`,
        relPath: `${ctx.relPath}.bak`,
        key: `${ctx.key}.bak`,
      };
    }

    // ------------------------------------------------------------------ queue

    _enqueue(kind, fn) {
      // A save that is queued but has not started yet absorbs further save
      // requests: only the final state matters, so a burst of autosaves collapses
      // into one write.
      if (kind === "save" && this._queuedSave) return this._queuedSave;

      let marker = null;
      const run = this._queue
        .then(() => {
          // The write has begun. Anything requested from here on must queue a
          // fresh save, or changes made during this write would be lost.
          if (this._queuedSave === marker) this._queuedSave = null;
          return fn();
        })
        // Operations report their own failures through _fail; swallowing here
        // keeps one rejection from wedging every later operation.
        .catch(() => {});

      marker = run;
      this._queue = run;
      if (kind === "save") this._queuedSave = run;
      return run;
    }

    // -------------------------------------------------------------- backends

    _resolveBackend(ctx) {
      const method = METHODS[this._methodIndex] || "auto";
      if (method === "auto") return resolveAuto(ctx);

      const backend = BACKENDS[method];
      if (!backend) throw new Error(`Unknown save method "${method}"`);

      // No fallback for an explicitly chosen backend. Quietly switching stores is
      // how a momentarily unreachable backend turns into a stale save file and an
      // apparently wiped player profile.
      if (!backend.isAvailable(ctx)) {
        const reason = backend.unavailableReason
          ? backend.unavailableReason(ctx)
          : "";
        throw new Error(
          `Save method "${method}" is unavailable.${reason ? `\n${reason}` : ""}`,
        );
      }
      return backend;
    }

    // ------------------------------------------------------------- json data

    _getJsonInstance() {
      const sid = this._jsonSid;
      if (sid === undefined || sid === null || sid < 0) return null;
      let oc = null;
      try {
        oc = this.runtime.sdk.getObjectClassBySid(sid);
      } catch (e) {
        return null;
      }
      return oc ? oc.getFirstInstance() : null;
    }

    _applyToJson(data) {
      const inst = this._getJsonInstance();
      if (!inst)
        throw new Error(
          "No JSON object is available. Check the JSON object property, and that the object " +
            "exists when the save loads (mark it global if it is not on the first layout).",
        );
      inst.setJsonDataCopy(data);
    }

    _readJson() {
      const inst = this._getJsonInstance();
      if (!inst) throw new Error("No JSON object is available to save from.");
      return inst.getJsonDataCopy();
    }

    // Fetched once at startup. Project files are immutable at runtime, so there is
    // nothing to invalidate and every later read is synchronous.
    async _loadDefaults() {
      if (this._defaultsReady) return;
      if (!this._defaultDataPath) {
        this._defaults = {};
        this._defaultsReady = true;
        return;
      }
      try {
        const data = await this.runtime.assets.fetchJson(this._defaultDataPath);
        this._defaults = data === null || data === undefined ? {} : data;
      } catch (e) {
        this._defaults = {};
        this._defaultsError = `Could not read default data "${this._defaultDataPath}": ${e.message || e}`;
        // Report immediately. Otherwise the first thing that surfaces a typo'd
        // path is a New save hours into a session, far from the cause.
        console.error(
          `[Save Manager: ${this.objectType.name}] ${this._defaultsError}`,
        );
      }
      this._defaultsReady = true;
    }

    // Synchronous. Hands back a copy so callers can never mutate the cache.
    _getDefaults() {
      if (!this._defaultsReady)
        throw new Error(
          "Default data is not loaded yet. It is fetched during startup, so this can only " +
            "happen if the action ran before beforeprojectstart.",
        );
      if (this._defaultsError) throw new Error(this._defaultsError);
      return JSON.parse(JSON.stringify(this._defaults));
    }

    _defaultsOrEmpty() {
      try {
        return this._getDefaults();
      } catch (e) {
        return {};
      }
    }

    // Shared skeleton for the backend-backed actions, so the resolve/try/catch/
    // trigger boilerplate lives in one place rather than in every ACE file.
    // `operation` is the machine-readable token reported by LastErrorOperation.
    _run(operation, triggerName, fn) {
      return this._enqueue(operation, () =>
        this._runNow(operation, triggerName, fn),
      );
    }

    async _runNow(operation, triggerName, fn) {
      try {
        await registry.whenReady(this.runtime);

        const ctx = this._buildContext("");
        const backend = this._resolveBackend(ctx);
        this._backend = backend.id;

        await fn.call(this, ctx, backend);
        this._lastError = "";
        this._lastErrorOperation = "";
        this._trigger(triggerName);
      } catch (e) {
        this._fail(e, operation);
      }
    }

    // Only a thrown read is retried. A null return means "no save" and is the
    // normal path; a JSON parse failure is deterministic, so re-running it would
    // just add latency to a startup that blocks the loading screen.
    async _readWithRetry(backend, ctx) {
      const delays = [0, 100, 300];
      let lastError = null;
      for (const delay of delays) {
        if (delay) await new Promise((r) => setTimeout(r, delay));
        try {
          return await backend.read(ctx);
        } catch (e) {
          lastError = e;
        }
      }
      throw lastError;
    }

    // The read succeeded but the contents are unusable, so we are holding the
    // original bytes and can preserve them verbatim.
    async _backupRaw(backend, ctx, raw) {
      try {
        await backend.write(this._toBackupContext(ctx), raw);
      } catch (e) {
        console.error(
          `[Save Manager: ${this.objectType.name}] Could not write backup: ${e.message || e}`,
        );
      }
    }

    // The read failed, so there are no bytes to write. Ask the backend for a
    // host-side copy instead, which does not route through read() and may still
    // succeed. Local storage has no copy primitive, so there the save is lost.
    async _backupByCopy(backend, ctx) {
      if (typeof backend.copy !== "function") return false;
      try {
        await backend.copy(ctx, this._toBackupContext(ctx));
        return true;
      } catch (e) {
        console.error(
          `[Save Manager: ${this.objectType.name}] Could not copy save to backup: ${e.message || e}`,
        );
        return false;
      }
    }

    // ------------------------------------------------------------ operations

    _doLoad(slot = "") {
      return this._enqueue("load", () => this._loadNow(slot));
    }

    async _loadNow(slot) {
      // Reset up front rather than in the catch: if the read succeeds but the
      // contents are corrupt, the save genuinely does exist and reporting
      // otherwise would let a "no save, start fresh" flow overwrite it.
      this._saveExisted = false;
      try {
        await registry.whenReady(this.runtime);

        const ctx = this._buildContext(slot);
        const backend = this._resolveBackend(ctx);
        this._backend = backend.id;

        const defaults = this._getDefaults();

        let raw;
        try {
          raw = await this._readWithRetry(backend, ctx);
        } catch (readError) {
          // No bytes in hand, so the only way to preserve the save is a
          // host-side copy. If the backend cannot copy, it is lost.
          await this._backupByCopy(backend, ctx);
          throw readError;
        }

        // null means no save. An empty string is a real, empty file and must not
        // be confused with one.
        this._saveExisted = raw !== null;

        let data = defaults;
        if (raw !== null) {
          let parsed;
          try {
            parsed = JSON.parse(raw);
          } catch (parseError) {
            // We are holding the original bytes: preserve them verbatim before
            // anything gets a chance to overwrite the file with defaults.
            await this._backupRaw(backend, ctx, raw);
            throw new Error(
              `Stored save data is not valid JSON: ${parseError.message || parseError}`,
            );
          }
          data = deepMerge(defaults, parsed);
        }

        this._applyToJson(data === null || data === undefined ? {} : data);
        this._isLoaded = true;
        this._lastError = "";
        this._lastErrorOperation = "";
        this._trigger("OnLoaded");
      } catch (e) {
        // Defaults are still applied so the game is playable. Whatever could be
        // preserved has been preserved above.
        try {
          this._applyToJson(this._defaultsOrEmpty());
          this._isLoaded = true;
        } catch (e2) {
          // Nothing to load into; the original error is the useful one.
        }
        this._fail(e, "load");
      }
    }

    _fail(error, operation) {
      this._lastError = error && error.message ? error.message : String(error);
      this._lastErrorOperation = operation || "";
      console.error(
        `[Save Manager: ${this.objectType.name}] ${this._lastError}`,
      );
      this._trigger("OnAnyError");
      const specific = ERROR_TRIGGERS[this._lastErrorOperation];
      if (specific) this._trigger(specific);
    }

    // ----------------------------------------------------------- expressions

    _getSavePath(slot = "") {
      const ctx = this._buildContext(slot);
      const method = METHODS[this._methodIndex] || "auto";
      const backendId = this._backend || (method === "auto" ? "" : method);

      try {
        if (backendId === "pipelab") {
          const pl = BACKENDS.pipelab.getInstance(ctx);
          const root = BACKENDS.pipelab.getFolderRoot(pl, ctx.folder);
          return root ? joinFromRoot(root, ctx.subfolder, ctx.fileName) : "";
        }
        if (backendId === "nodejs")
          return joinPath(ctx.subfolder, ctx.fileName);
        if (backendId === "webview") return ctx.relPath;
      } catch (e) {
        return "";
      }
      return "";
    }

    // ---------------------------------------------------------------- events

    _trigger(method) {
      this.dispatch(method);
      super._trigger(self.C3[AddonTypeMap[addonType]][id].Cnds[method]);
    }

    on(tag, callback, options) {
      if (!this.events[tag]) {
        this.events[tag] = [];
      }
      this.events[tag].push({ callback, options });
    }

    off(tag, callback) {
      if (this.events[tag]) {
        this.events[tag] = this.events[tag].filter(
          (event) => event.callback !== callback,
        );
      }
    }

    dispatch(tag) {
      if (this.events[tag]) {
        this.events[tag].forEach((event) => {
          if (event.options && event.options.params) {
            const fn = self.C3[AddonTypeMap[addonType]][id].Cnds[tag];
            if (fn && !fn.call(this, ...event.options.params)) {
              return;
            }
          }
          event.callback();
          if (event.options && event.options.once) {
            this.off(tag, event.callback);
          }
        });
      }
    }

    _release() {
      if (this._onBeforeProjectStart) {
        this.runtime.removeEventListener(
          "beforeprojectstart",
          this._onBeforeProjectStart,
        );
        this._onBeforeProjectStart = null;
      }
      super._release();
    }

    _saveToJson() {
      return {
        backend: this._backend,
        isLoaded: this._isLoaded,
        saveExisted: this._saveExisted,
        lastError: this._lastError,
        lastErrorOperation: this._lastErrorOperation,
      };
    }

    _loadFromJson(o) {
      if (!o) return;
      this._backend = o.backend || "";
      this._isLoaded = !!o.isLoaded;
      this._saveExisted = !!o.saveExisted;
      this._lastError = o.lastError || "";
      this._lastErrorOperation = o.lastErrorOperation || "";
    }
  };
}
