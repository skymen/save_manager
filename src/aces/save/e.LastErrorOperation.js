export const config = {
  highlight: false,
  isDeprecated: false,
  returnType: "string",
  description:
    'Which operation the last error came from: "load", "save", "delete" or "check". Empty if the last operation succeeded',
  params: [],
};

export const expose = true;

export default function () {
  return this._lastErrorOperation;
}
