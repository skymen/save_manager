export const config = {
  highlight: false,
  isDeprecated: false,
  isTrigger: true,
  listName: "On loaded",
  displayText: "On loaded",
  description: "Triggered after save data has been loaded and merged into the JSON object",
  params: [],
};

export const expose = true;

export default function () {
  return true;
}
