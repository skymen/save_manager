<img src="./src/icon.svg" width="100" /><br>
# Save Manager
<i>A plugin to manage JSON based save files</i> <br>
### Version 1.0.0.0

[<img src="https://placehold.co/200x50/4493f8/FFF?text=Download&font=montserrat" width="200"/>](https://github.com/skymen/save_manager/releases/download/skymen_save_manager-1.0.0.0.c3addon/skymen_save_manager-1.0.0.0.c3addon)
<br>
<sub> [See all releases](https://github.com/skymen/save_manager/releases) </sub> <br>

#### What's New in 1.0.0.0
- **Added:** Initial working version

<sub>[View full changelog](#changelog)</sub>

---
<b><u>Author:</u></b> skymen <br>
<sub>Made using [CAW](https://marketplace.visualstudio.com/items?itemName=skymen.caw) </sub><br>

## Table of Contents
- [Usage](#usage)
- [Examples Files](#examples-files)
- [Properties](#properties)
- [Actions](#actions)
- [Conditions](#conditions)
- [Expressions](#expressions)
---
## Usage
To build the addon, run the following commands:

```
npm i
npm run build
```

To run the dev server, run

```
npm i
npm run dev
```

## Examples Files

---
## Properties
| Property Name | Description | Type |
| --- | --- | --- |
| Auto load | Load the save before the project starts, so the data is ready when the first layout begins | check |
| Method | Where the save is stored. Auto picks the best available backend at runtime | combo |
| JSON object | The JSON object this plugin loads into and saves from | object |
| Default data | Optional project file holding the default save data. Loaded first, then the stored save is merged on top | projectfile |
| Extension | File extension for the save. The file is named after this object type, e.g. PlayerSave.sav | text |
| Folder | Which common folder file based backends write to. Ignored by local storage and custom | combo |
| Subfolder | Subfolder inside the chosen folder. Leave blank to use the project name | text |
| Custom handler ID | Name the handler was registered under via globalThis.SaveManager.register(). Only used when Method is Custom | text |


---
## Actions
| Action | Description | Params
| --- | --- | --- |
| Check if save exists | Ask the backend whether a save exists, then read the result with the Has save data condition |  |
| Delete save | Remove the stored save from the selected backend. The JSON object is left as is |  |
| Load | Load the default data, then merge the stored save on top of it, into the JSON object |  |
| New save | Load only the default data into the JSON object. Nothing is written until you use Save |  |
| Save | Write the JSON object's current contents to the selected backend |  |


---
## Conditions
| Condition | Description | Params
| --- | --- | --- |
| Has save data | True if the last load or check found an existing save. Conditions cannot do IO, so use Check if save exists first to refresh this |  |
| Is loaded | True once data has been loaded into the JSON object at least once |  |
| Is using backend | Check which backend was actually resolved, which is useful when Method is Auto | Backend *(combo)* <br> |
| On deleted | Triggered after the stored save has been deleted |  |
| On error | Triggered when a load, save, delete or check fails. Read LastError for details |  |
| On loaded | Triggered after save data has been loaded and merged into the JSON object |  |
| On new save | Triggered after a new save has been started from the default data |  |
| On save checked | Triggered after Check if save exists finishes |  |
| On saved | Triggered after save data has been written successfully |  |


---
## Expressions
| Expression | Description | Return Type | Params
| --- | --- | --- | --- |
| Backend | The backend actually in use: localstorage, nodejs, webview, pipelab or custom. Empty until the first operation resolves one | string |  | 
| LastError | The message from the most recent failure, or an empty string if the last operation succeeded | string |  | 
| SaveName | The resolved save file name, which is this object type's name plus the extension. Also the local storage key | string |  | 
| SavePath | The path the save is written to for file based backends. Empty for local storage and custom backends | string |  | 


---
## Changelog

**1.0.0.0**
- **Added:** Initial working version

**0.0.0.0**
- **Added:** Initial release.
