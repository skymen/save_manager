export const config = {
  highlight: true,
  isDeprecated: false,
  isAsync: true,
  listName: "Load",
  displayText: "Load save data",
  description:
    "Load the default data, then merge the stored save on top of it, into the JSON object",
  params: [],
};

export const expose = true;

export default function () {
  return this._doLoad();
}
