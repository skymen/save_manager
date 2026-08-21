export const config = {
  highlight: false,
  isDeprecated: false,
  isTrigger: true,
  listName: "On any error",
  displayText: "On any error",
  description:
    "Triggered when any load, save, delete or check fails. Read LastError for the message and LastErrorOperation for which operation it was",
  params: [],
};

export const expose = true;

export default function () {
  return true;
}
