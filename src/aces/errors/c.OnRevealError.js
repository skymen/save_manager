export const config = {
  highlight: false,
  isDeprecated: false,
  isTrigger: true,
  listName: "On reveal error",
  displayText: "On reveal error",
  description:
    "Triggered when revealing the save location fails, which usually means the backend has no folder to open",
  params: [],
};

export const expose = true;

export default function () {
  return true;
}
