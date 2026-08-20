export const config = {
  highlight: false,
  isDeprecated: false,
  isAsync: true,
  listName: "Check if save exists",
  displayText: "Check if save data exists",
  description:
    "Ask the backend whether a save exists, then read the result with the Has save data condition",
  params: [],
};

export const expose = true;

export default function () {
  return this._run("check", "OnSaveChecked", async (ctx, backend) => {
    this._saveExisted = await backend.exists(ctx);
  });
}
