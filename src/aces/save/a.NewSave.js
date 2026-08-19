export const config = {
  highlight: true,
  isDeprecated: false,
  // Synchronous: the default data is fetched and cached during startup, and a
  // new save touches no backend, so there is nothing left to await.
  isAsync: false,
  listName: "New save",
  displayText: "Start a new save",
  description:
    "Load only the default data into the JSON object. Nothing is written until you use Save",
  params: [],
};

export const expose = true;

export default function () {
  try {
    this._applyToJson(this._getDefaults());
    this._isLoaded = true;
    this._saveExisted = false;
    this._lastError = "";
    this._trigger("OnNewSave");
  } catch (e) {
    this._fail(e);
  }
}
