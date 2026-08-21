export const config = {
  highlight: false,
  isDeprecated: false,
  returnType: "string",
  description:
    "The backend actually in use: localstorage, nodejs, webview, pipelab or custom. Empty until the first operation resolves one",
  params: [],
};

export const expose = true;

export default function () {
  return this._backend;
}
