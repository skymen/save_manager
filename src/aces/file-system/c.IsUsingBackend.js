export const config = {
  highlight: false,
  isDeprecated: false,
  isTrigger: false,
  isInvertible: true,
  listName: "Is using backend",
  displayText: "Is using {0} backend",
  description:
    "Check which backend was actually resolved, which is useful when Method is Auto",
  params: [
    {
      id: "backend",
      name: "Backend",
      desc: "The backend to test against",
      type: "combo",
      initialValue: "localstorage",
      items: [
        { localstorage: "Local storage" },
        { nodejs: "NW.js" },
        { webview: "Webview (File System plugin)" },
        { pipelab: "Pipelab" },
        { custom: "Custom" },
      ],
    },
  ],
};

export const expose = true;

export default function (backend) {
  // Combo params arrive as zero based indices, matching the item order above.
  const ids = ["localstorage", "nodejs", "webview", "pipelab", "custom"];
  return this._backend === ids[backend];
}
