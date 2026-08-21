export const config = {
  highlight: false,
  isDeprecated: false,
  returnType: "string",
  description: "The message from the most recent failure, or an empty string if the last operation succeeded",
  params: [],
};

export const expose = true;

export default function () {
  return this._lastError;
}
