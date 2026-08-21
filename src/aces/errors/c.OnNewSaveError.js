export const config = {
  highlight: false,
  isDeprecated: false,
  isTrigger: true,
  listName: "On new save error",
  displayText: "On new save error",
  description: "Triggered when starting a new save fails, which means the default data could not be read",
  params: [],
};

export const expose = true;

export default function () {
  return true;
}
