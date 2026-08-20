export const config = {
  highlight: false,
  isDeprecated: false,
  isAsync: true,
  listName: "Delete save",
  displayText: "Delete save data",
  description: "Remove the stored save from the selected backend. The JSON object is left as is",
  params: [],
};

export const expose = true;

export default function () {
  return this._run("delete", "OnDeleted", async (ctx, backend) => {
    await backend.remove(ctx);
    this._saveExisted = false;
  });
}
