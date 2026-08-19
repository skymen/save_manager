export const config = {
  highlight: true,
  isDeprecated: false,
  isAsync: true,
  listName: "Save",
  displayText: "Save data",
  description: "Write the JSON object's current contents to the selected backend",
  params: [],
};

export const expose = true;

export default function () {
  return this._doSave();
}
