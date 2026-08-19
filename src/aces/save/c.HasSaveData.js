export const config = {
  highlight: false,
  isDeprecated: false,
  isTrigger: false,
  isInvertible: true,
  listName: "Has save data",
  displayText: "Has save data",
  description:
    "True if the last load or check found an existing save. Conditions cannot do IO, so use Check if save exists first to refresh this",
  params: [],
};

export const expose = true;

export default function () {
  return this._saveExisted;
}
