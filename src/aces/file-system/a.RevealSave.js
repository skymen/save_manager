export const config = {
  highlight: false,
  isDeprecated: false,
  isAsync: true,
  listName: "Reveal save location",
  displayText: "Reveal save location",
  description:
    "Open the folder containing the save in the operating system's file manager. Only works on backends that store real files",
  params: [],
};

export const expose = true;

export default function () {
  return this._run("reveal", null, async (ctx, backend) => {
    if (typeof backend.reveal !== "function")
      throw new Error(
        `The ${backend.id} backend does not store a file, so there is no location to reveal.`
      );
    await backend.reveal(ctx);
  });
}
