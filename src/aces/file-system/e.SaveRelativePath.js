export const config = {
  highlight: false,
  isDeprecated: false,
  returnType: "string",
  description:
    "The save's path from the selected folder down, e.g. MyGame/PlayerSave.sav. Pass this to the File System plugin along with a picker tag",
  params: [],
};

export const expose = true;

export default function () {
  return this._getSaveRelativePath("");
}
