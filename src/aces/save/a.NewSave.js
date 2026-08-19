export const config = {
  highlight: true,
  isDeprecated: false,
  isAsync: true,
  listName: "New save",
  displayText: "Start a new save",
  description:
    "Load only the default data into the JSON object. Nothing is written until you use Save",
  params: [],
};

export const expose = true;

export default function () {
  return this._doNewSave();
}
