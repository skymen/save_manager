export const config = {
  highlight: false,
  isDeprecated: false,
  isTrigger: true,
  listName: "On error",
  displayText: "On error",
  description: "Triggered when a load, save, delete or check fails. Read LastError for details",
  params: [],
};

export const expose = true;

export default function () {
  return true;
}
