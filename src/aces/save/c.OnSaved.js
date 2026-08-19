export const config = {
  highlight: false,
  isDeprecated: false,
  isTrigger: true,
  listName: "On saved",
  displayText: "On saved",
  description: "Triggered after save data has been written successfully",
  params: [],
};

export const expose = true;

export default function () {
  return true;
}
