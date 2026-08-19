export const config = {
  highlight: false,
  isDeprecated: false,
  isTrigger: false,
  isInvertible: true,
  listName: "Is loaded",
  displayText: "Is loaded",
  description: "True once data has been loaded into the JSON object at least once",
  params: [],
};

export const expose = true;

export default function () {
  return this._isLoaded;
}
