export const config = {
  highlight: false,
  isDeprecated: false,
  isTrigger: true,
  listName: "On new save",
  displayText: "On new save",
  description: "Triggered after a new save has been started from the default data",
  params: [],
};

export const expose = true;

export default function () {
  return true;
}
