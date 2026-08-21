export const config = {
  highlight: false,
  isDeprecated: false,
  isTrigger: true,
  listName: "On save error",
  displayText: "On save error",
  description: "Triggered when a save fails. Nothing was written, so the stored save is unchanged",
  params: [],
};

export const expose = true;

export default function () {
  return true;
}
