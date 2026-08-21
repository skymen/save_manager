export const config = {
  highlight: false,
  isDeprecated: false,
  returnType: "string",
  description:
    "The resolved save file name, which is this object type's name plus the extension. Also the local storage key",
  params: [],
};

export const expose = true;

export default function () {
  return this._resolveName("");
}
