import {
  ADDON_CATEGORY,
  ADDON_TYPE,
  PLUGIN_TYPE,
  PROPERTY_TYPE,
} from "./template/enums.js";
import _version from "./version.js";
export const addonType = ADDON_TYPE.PLUGIN;
export const type = PLUGIN_TYPE.OBJECT;
export const id = "skymen_save_manager";
export const name = "Save Manager";
export const version = _version;
// projectfile properties require r426+
export const minConstructVersion = "r426";
export const author = "skymen";
export const website = "https://www.construct.net";
export const documentation = "https://www.construct.net";
export const description = "A plugin to manage JSON based save files";
export const category = ADDON_CATEGORY.DATA_AND_STORAGE;

export const hasDomside = false;
export const files = {
  extensionScript: {
    enabled: false, // set to false to disable the extension script
    watch: true, // set to true to enable live reload on changes during development
    targets: ["x86", "x64"],
    // you don't need to change this, the build step will rename the dll for you. Only change this if you change the name of the dll exported by Visual Studio
    name: "MyExtension",
  },
  fileDependencies: [],
  remoteFileDependencies: [
    // {
    //   src: "https://example.com/api.js", // Must use https:// or same-protocol // URLs. http:// is not allowed.
    //   type: "" // Optional: "" or "module". Empty string or omit for classic script.
    // }
  ],
  cordovaPluginReferences: [],
  cordovaResourceFiles: [],
};

// categories that are not filled will use the folder name
export const aceCategories = {
  save: "Save Manager",
};

export const info = {
  // icon: "icon.svg",
  // PLUGIN world only
  // defaultImageUrl: "default-image.png",
  Set: {
    // COMMON to all
    CanBeBundled: true,
    IsDeprecated: false,
    GooglePlayServicesEnabled: false,

    // BEHAVIOR only
    IsOnlyOneAllowed: false,

    // PLUGIN world only
    IsResizable: false,
    IsRotatable: false,
    Is3D: false,
    HasImage: false,
    IsTiled: false,
    SupportsZElevation: false,
    SupportsColor: false,
    SupportsEffects: false,
    MustPreDraw: false,

    // PLUGIN object only
    // Must stay false: the plugin is added once per managed JSON object, and the
    // object type name is what makes each save file unique.
    IsSingleGlobal: false,
  },
  // PLUGIN only
  AddCommonACEs: {
    Position: false,
    SceneGraph: false,
    Size: false,
    Angle: false,
    Appearance: false,
    ZOrder: false,
  },
};

// NOTE: property order is load bearing. _getInitProperties() returns values
// positionally, so new properties must be appended, never inserted. Do not add
// group/link/info properties: whether they occupy a runtime slot is inconsistent.
export const properties = [
  {
    type: PROPERTY_TYPE.CHECK,
    id: "autoLoad",
    options: {
      initialValue: true,
    },
    name: "Auto load",
    desc: "Load the save before the project starts, so the data is ready when the first layout begins",
  },
  {
    type: PROPERTY_TYPE.COMBO,
    id: "method",
    options: {
      initialValue: "auto",
      items: [
        { auto: "Auto" },
        { localstorage: "Local storage" },
        { nodejs: "NW.js" },
        { webview: "Webview (File System plugin)" },
        { pipelab: "Pipelab" },
        { custom: "Custom" },
      ],
    },
    name: "Method",
    desc: "Where the save is stored. Auto picks the best available backend at runtime",
  },
  {
    type: PROPERTY_TYPE.OBJECT,
    id: "jsonObject",
    options: {
      allowedPluginIds: ["Json"],
    },
    name: "JSON object",
    desc: "The JSON object this plugin loads into and saves from",
  },
  {
    type: PROPERTY_TYPE.PROJECTFILE,
    id: "defaultData",
    options: {
      filter: ".json",
    },
    name: "Default data",
    desc: "Optional project file holding the default save data. Loaded first, then the stored save is merged on top",
  },
  {
    type: PROPERTY_TYPE.TEXT,
    id: "extension",
    options: {
      initialValue: "sav",
    },
    name: "Extension",
    desc: "File extension for the save. The file is named after this object type, e.g. PlayerSave.sav",
  },
  {
    type: PROPERTY_TYPE.COMBO,
    id: "folder",
    options: {
      initialValue: "appdata",
      items: [
        { appdata: "App data" },
        { home: "Home" },
        { appfolder: "App folder" },
      ],
    },
    name: "Folder",
    desc: "Which common folder file based backends write to. Ignored by local storage and custom",
  },
  {
    type: PROPERTY_TYPE.TEXT,
    id: "subfolder",
    options: {
      initialValue: "",
    },
    name: "Subfolder",
    desc: "Subfolder inside the chosen folder. Leave blank to use the project name",
  },
  {
    type: PROPERTY_TYPE.TEXT,
    id: "customHandlerId",
    options: {
      initialValue: "",
    },
    name: "Custom handler ID",
    desc: "Name the handler was registered under via globalThis.SaveManager.register(). Only used when Method is Custom",
  },
];
