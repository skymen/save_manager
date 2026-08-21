export const config = {
  highlight: false,
  isDeprecated: false,
  returnType: "string",
  description:
    "The path the save is written to for file based backends. Empty for local storage and custom backends",
  params: [],
};

export const expose = true;

export default function () {
  return this._getSavePath("");
}
