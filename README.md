# TickTockFocus

<img src="icons/icon128.png" alt="" width="64" align="right">

A multi-step focus timer for Chrome: Pomodoro, 52/17 or your own routine. A routine is a sequence of steps, such as 25 minutes of focus and 5 of break, that run back to back, with a notification at the end of every step. No site access, no account required.

[Website](https://ticktockfocus.com) · [Install from the Chrome Web Store](https://chromewebstore.google.com/detail/nealkefeifpkmkbfcfbkffdgnlohjbae)

## Features

- Five ready-made routines to start from: Pomodoro, 52/17, Deep work, Study and Desk break
- A welcome page after installing, to pick the routines you want and learn how the timer works
- Routines of up to 20 steps of 30 seconds or more, each Focus, Break or Custom, with repeat groups (×2 to ×10) for cycles like Pomodoro; reorder steps by dragging or with the ↑/↓ buttons
- A progress ring split into the routine's steps and coloured by kind
- Pause, skip or add 5 minutes; the next step starts automatically or waits for you
- The minutes left in the current step on the toolbar icon, in the step's colour
- Notifications with buttons: pause or skip a step, start the next one or stop, and start a finished routine again
- A short sound at the end of each step (Chime, Bell or Soft) with its own volume, or none
- Keeps running with the popup closed. If the timer ended while Chrome was closed or the computer was asleep, one silent notification tells you when it finished
- Routines and settings sync across your computers when Chrome Sync is on
- Light and dark theme, 12- or 24-hour time, usable with just the keyboard
- In English and Ukrainian, following the language Chrome is displayed in

## Usage

1. After installing, the welcome page opens: tick the routines you want to start with and click **Add selected**. While you have no routines, the **Timer** tab offers the same ones with **Add**, next to **or build your own**.
2. On the **Routines** tab, click **New routine**, enter a name and add steps; **Add repeat group** adds a Focus and a Break step that repeat, and you can change them or add more. Click **Save**.
3. On the **Timer** tab, click a routine to start it. **Pause**, **Skip**, **+5 min** and **Stop** control the run. The toolbar icon shows the minutes left, **II** while paused and **▶** while the next step waits for you.
4. When a step ends, the notification's buttons pause, skip, start the next step or stop without opening the popup.
5. On the **Routines** tab, ▶ starts a routine and **⋯** edits, duplicates or deletes it.
6. **Settings** (⚙) chooses whether the next step starts automatically or waits for you, the time format, the sound and its volume (**Test** plays it), and whether the toolbar icon shows the time left. **How it works** opens the welcome page's guide again.

## Development

There is no build step and there are no dependencies: the repository root is the unpacked extension. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and select the repository folder. Chrome 120 or later is required.

The unit tests for the shared logic run on Node's built-in test runner, with nothing to install: `npm test` (or `node --test`).

## Languages

The extension is in English and Ukrainian and follows the language Chrome is displayed in; there is no language setting of its own. Chrome in any other language shows English. The texts live in `_locales/<code>/messages.json`, read through `chrome.i18n`.

To add a language:

1. Copy `_locales/en` to `_locales/<code>`, using Chrome's code for the language, such as `de` or `pt_BR`.
2. Translate every `message` in the copy. Keep the `{placeholders}` and the name TickTockFocus as they are, and set `languageCode` to the code with a hyphen (`de`, `pt-BR`). `chrome.i18n` has no plural forms, so word the texts so that they read right with any number, like "Steps: 8".
3. Run `npm test`. It checks that the new language has every message with the same placeholders, that none is empty, and that the name and description fit the Chrome Web Store's limits of 75 and 132 characters.
4. Switch Chrome to that language (Settings → Languages, or start Chrome with `--lang=<code>`), reload the extension and check that no text is cut off in the popup and on the welcome page.

## Privacy

The extension uses only the `storage`, `alarms`, `notifications` and `offscreen` permissions. `offscreen` lets it play the end-of-step sound from a hidden extension page, because the background service worker can't play audio; that page only plays the sound files bundled with the extension and handles no data. Routines and settings live in Chrome's sync storage, so they follow your Google account when Chrome Sync is on; the running timer stays in your browser. To know when to ask for a rating, the extension counts the routines you finish and remembers your answer to that question; both stay in the browser's local storage, are never synced or sent anywhere, and nothing checks whether you left a rating. There are no servers, tracking or analytics. When you remove the extension, Chrome opens a short page on ticktockfocus.com that asks for feedback; the extension sends nothing with it. See the [privacy policy](https://ticktockfocus.com/privacy.html).

## License

[Apache 2.0](LICENSE). The sounds are Creative Commons 0 recordings from Freesound; [sounds/README.md](sounds/README.md) lists their sources. Report bugs and ideas in [GitHub issues](https://github.com/mist941/tick-tock-focus/issues).
