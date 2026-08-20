- Implement slots

- Implement save versionning

1. nodejs.write truncates in place. fs.writeFileSync(file, text) opens with w, so the file is zeroed and then rewritten. Any process death inside that window leaves a truncated or empty save. No temp file, no rename, no backup copy, no fsync — so even a clean return doesn't mean the bytes reached the disk rather than the OS page cache.

2. The three backends have different durability guarantees, and the project can't see which it got. localstorage goes through Construct's IndexedDB store, which is transactional per key. nodejs is the truncate-in-place above. webview delegates to mode: "overwrite" in Construct's native extension, whose atomicity you can't verify or control. With method: auto a project silently gets whichever one the platform resolved to.

3. writeFileSync is synchronous inside an async function. nodejs.write is declared async and awaited like non-blocking I/O, but the call blocks the main thread for the duration. Callers can't detect this or schedule around it, and on Windows AppData that's exactly where Defender's on-close scan lands.

The interaction I'd worry about most

4. A failed load is indistinguishable from a fresh install, and the next save destroys the real one. \_doLoad's catch calls \_applyToJson(this.\_defaultsOrEmpty()) and sets \_isLoaded = true, then fires OnError. If a project doesn't wire OnError — and nothing forces it to — a transient read failure presents to the game as a new player. The game then plays normally, hits its first save, and overwrites a perfectly good save file with defaults. The project did nothing wrong; the failure mode is silent, total, and reached through the default path.

\_saveExisted is reset before the read specifically so a genuine IO failure isn't reported as "no save" — that care is exactly right, but it doesn't reach the JSON object, which is what the game actually reads.

Invariants that leak to the consumer

5. No write serialisation inside the plugin. Nothing stops two Save operations overlapping on one instance, so every consuming project has to build its own mutex. Mine is a pair of boolean globals plus a reset path, in event sheets — and if that reset is ever missed, saving stops permanently for the session. That's the plugin's invariant being enforced by every consumer, each of whom has to get it right independently.

6. \_run has no in-flight guard either, so Save during Load is reachable — a read and a write racing the same file, with \_applyToJson able to replace the JSON object's contents midway through a save that's reading from it.

Identity coupling

7. The save filename is derived from the object type name, and the folder from the project name. \_resolveName uses sanitizeSegment(this.objectType.name); \_resolveSubfolder falls back to runtime.projectName. So renaming the object in the editor, or renaming the project, silently orphans every existing player save. Both are ordinary editor actions with no visible connection to save compatibility, and the failure surfaces as "my players lost their saves after the update."

Backend resolution

8. auto can resolve differently between launches. If the File System native extension fails to init once, webview drops out and the next candidate wins — pointing at a different store with different contents. The explicit-method path refuses to fall back precisely because that's "how a momentarily unreachable backend turns into ... an apparently wiped player profile", but auto, the default, has no equivalent protection and no detection of "a save exists in the store we didn't pick."

9. The AUTO_ORDER comment contradicts the code. The comment explains Pipelab being first; the array is ["webview", "nodejs", "pipelab", "localstorage"]. The changelog's "Changed priority order for Auto Backend" suggests it went stale — worth knowing which one reflects the intent.

Error surface

10. OnError is one trigger shared by load, save, delete and check. It doesn't say which operation failed, so a project can't respond differently to "couldn't read" and "couldn't write." LastError is a prose string, so distinguishing causes means substring-matching English.

11. HasSaveData's meaning depends on which operation ran last — load or check — and conditions can't refresh it themselves. Correct given C3's constraints, but it makes the condition's answer positional in a way that's easy to get wrong.

Smaller

12. Slot plumbing is dead. \_doLoad, \_buildContext and \_resolveName all take a slot, but every ACE passes "". The internals imply multi-slot saves that aren't reachable from events.

13. A bad default-data path can stay invisible for a long time. \_loadDefaults records \_defaultsError, but \_defaultsOrEmpty() swallows it on the load path. The first thing that actually surfaces it is a New save, via \_getDefaults() throwing — potentially hours into a session, far from the typo.

14. \_saveToJson/\_loadFromJson persist backend/isLoaded/saveExisted into Construct's own savegame system — a second, independent save mechanism. Restoring a C3 savegame restores stale beliefs about a file that may have changed since.

15. NewSave is sync and calls \_getDefaults(), which throws before beforeprojectstart. Reachable from runOnStartup or an early script, where it errors rather than degrading.

For what it's worth, the parts that are clearly deliberate — blocking on beforeprojectstart so load precedes the first layout, the beforeLoad hook existing because concurrent beforeprojectstart listeners would race, deepMerge replacing arrays wholesale, refusing fallback on an explicit method — are the load-bearing decisions and they're right. The gaps above are mostly about what happens when the write or the read doesn't go to plan.

- webview path should be the full path like the other platforms
- maybe add an action to open the file path on supported platforms
- make categories and cleanup language and code
