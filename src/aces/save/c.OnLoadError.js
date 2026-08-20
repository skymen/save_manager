export const config = {
  highlight: false,
  isDeprecated: false,
  isTrigger: true,
  listName: "On load error",
  displayText: "On load error",
  description: "Triggered when a load fails. The default data is still applied so the game is playable, and the previous save has been backed up where the backend allows it",
  params: [],
};

export const expose = true;

export default function () {
  return true;
}
