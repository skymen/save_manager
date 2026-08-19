export const config = {
  highlight: false,
  isDeprecated: false,
  isTrigger: true,
  listName: "On deleted",
  displayText: "On deleted",
  description: "Triggered after the stored save has been deleted",
  params: [],
};

export const expose = true;

export default function () {
  return true;
}
