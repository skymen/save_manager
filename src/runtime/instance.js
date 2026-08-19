import { id, addonType } from "../../config.caw.js";
import AddonTypeMap from "../../template/addonTypeMap.js";
import { deepMerge, isPlainObject } from "./merge.js";
import { joinPath, joinFromRoot, sanitizeSegment } from "./paths.js";
import { BACKENDS, resolveAuto } from "./backends/index.js";
import "./registry.js";

const METHODS = ["auto", "localstorage", "nodejs", "webview", "pipelab", "custom"];
const FOLDERS = ["appdata", "home", "appfolder"];

export default function (parentClass) {
  return class extends parentClass {
    constructor() {
      super();

      this._backend = "";
      this._isLoaded = false;
      this._saveExisted = false;
      this._lastError = "";
      this._onBeforeProjectStart = null;

      const properties = this._getInitProperties();
      if (properties) {
        this._autoLoad = !!properties[0];
        this._methodIndex = properties[1] | 0;
        this._jsonSid = properties[2];
        this._defaultDataPath = properties[3] || "";
        this._extension = String(properties[4] ?? "sav").replace(/^\.+/, "");
        this._folderIndex = properties[5] | 0;
        this._subfolder = String(properties[6] ?? "");
        this._customHandlerId = String(properties[7] ?? "");
      } else {
        this._autoLoad = false;
        this._methodIndex = 0;
        this._jsonSid = -1;
        this._defaultDataPath = "";
        this._extension = "sav";
        this._folderIndex = 0;
        this._subfolder = "";
        this._customHandlerId = "";
      }

      // Instances of a non single global plugin are created inside Runtime.Start(),
      // after Construct has already awaited its load promises, so addLoadPromise is
      // not an option for us. beforeprojectstart is the next hook and blocks just as
      // hard: Construct collects each listener's returned promise and awaits them all
      // before the first layout starts, so the data is ready before any event runs.
      if (this._autoLoad) {
        this._onBeforeProjectStart = () => this._doLoad();
        this.runtime.addEventListener("beforeprojectstart", this._onBeforeProjectStart);
      }
    }

    // ---------------------------------------------------------------- naming

    _resolveName(slot) {
      const base = sanitizeSegment(this.objectType.name);
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
        const reason = backend.unavailableReason ? backend.unavailableReason(ctx) : "";
        throw new Error(`Save method "${method}" is unavailable.${reason ? `\n${reason}` : ""}`);
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
            "exists when the save loads (mark it global if it is not on the first layout)."
        );
      inst.setJsonDataCopy(data);
    }

    _readJson() {
      const inst = this._getJsonInstance();
      if (!inst) throw new Error("No JSON object is available to save from.");
      return inst.getJsonDataCopy();
    }

    // Deliberately not cached. Construct's asset manager already caches local
    // project files, and holding our own copy would make a second load in the
    // same session silently reuse stale defaults.
    async _fetchDefaults() {
      if (!this._defaultDataPath) return {};
      try {
        return await this.runtime.assets.fetchJson(this._defaultDataPath);
      } catch (e) {
        throw new Error(
          `Could not read default data "${this._defaultDataPath}": ${e.message || e}`
        );
      }
    }

    async _defaultsOrEmpty() {
      try {
        const data = await this._fetchDefaults();
        return data === null || data === undefined ? {} : data;
      } catch (e) {
        return {};
      }
    }

    // ------------------------------------------------------------ operations

    async _doLoad(slot = "") {
      // Reset up front rather than in the catch: if the read succeeds but the
      // contents are corrupt, the save genuinely does exist and reporting
      // otherwise would let a "no save, start fresh" flow overwrite it.
      this._saveExisted = false;
      try {
        const ctx = this._buildContext(slot);
        const backend = this._resolveBackend(ctx);
        this._backend = backend.id;

        const defaults = await this._fetchDefaults();
        const raw = await backend.read(ctx);

        // null means no save. An empty string is a real, empty file and must not
        // be confused with one.
        this._saveExisted = raw !== null;

        let data = defaults;
        if (raw !== null) {
          let parsed;
          try {
            parsed = JSON.parse(raw);
          } catch (e) {
            throw new Error(`Stored save data is not valid JSON: ${e.message || e}`);
          }
          data = deepMerge(defaults, parsed);
        }

        this._applyToJson(data === null || data === undefined ? {} : data);
        this._isLoaded = true;
        this._lastError = "";
        this._trigger("OnLoaded");
      } catch (e) {
        try {
          this._applyToJson(await this._defaultsOrEmpty());
          this._isLoaded = true;
        } catch (e2) {
          // Nothing to load into; the original error is the useful one.
        }
        this._fail(e);
      }
    }

    async _doSave(slot = "") {
      try {
        const ctx = this._buildContext(slot);
        const backend = this._resolveBackend(ctx);
        this._backend = backend.id;

        await backend.write(ctx, JSON.stringify(this._readJson()));
        this._saveExisted = true;
        this._lastError = "";
        this._trigger("OnSaved");
      } catch (e) {
        this._fail(e);
      }
    }

    async _doNewSave() {
      try {
        this._applyToJson(await this._fetchDefaults());
        this._isLoaded = true;
        this._saveExisted = false;
        this._lastError = "";
        this._trigger("OnNewSave");
      } catch (e) {
        this._fail(e);
      }
    }

    async _doDelete(slot = "") {
      try {
        const ctx = this._buildContext(slot);
        const backend = this._resolveBackend(ctx);
        this._backend = backend.id;

        await backend.remove(ctx);
        this._saveExisted = false;
        this._lastError = "";
        this._trigger("OnDeleted");
      } catch (e) {
        this._fail(e);
      }
    }

    async _doCheckExists(slot = "") {
      try {
        const ctx = this._buildContext(slot);
        const backend = this._resolveBackend(ctx);
        this._backend = backend.id;

        this._saveExisted = await backend.exists(ctx);
        this._lastError = "";
        this._trigger("OnSaveChecked");
      } catch (e) {
        this._fail(e);
      }
    }

    _fail(error) {
      this._lastError = error && error.message ? error.message : String(error);
      console.error(`[Save Manager: ${this.objectType.name}] ${this._lastError}`);
      this._trigger("OnError");
    }

    // ----------------------------------------------------------- expressions

    _getSavePath(slot = "") {
      const ctx = this._buildContext(slot);
      const method = METHODS[this._methodIndex] || "auto";
      const backendId = this._backend || (method === "auto" ? "" : method);

      try {
        if (backendId === "pipelab") {
          const pl = BACKENDS.pipelab.getInstance(ctx);
          const field = { appdata: "_appDataFolder", home: "_homeFolder", appfolder: "_exeFolder" }[
            ctx.folder
          ];
          return pl ? joinFromRoot(pl[field], ctx.subfolder, ctx.fileName) : "";
        }
        if (backendId === "nodejs") return joinPath(ctx.subfolder, ctx.fileName);
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
          (event) => event.callback !== callback
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
        this.runtime.removeEventListener("beforeprojectstart", this._onBeforeProjectStart);
        this._onBeforeProjectStart = null;
      }
      super._release();
    }

    _saveToJson() {
      return {
        backend: this._backend,
        isLoaded: this._isLoaded,
        saveExisted: this._saveExisted,
      };
    }

    _loadFromJson(o) {
      if (!o) return;
      this._backend = o.backend || "";
      this._isLoaded = !!o.isLoaded;
      this._saveExisted = !!o.saveExisted;
    }
  };
}
