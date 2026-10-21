# TickTockFocus

<img src="icons/icon128.png" alt="" width="64" align="right">

A multi-step focus timer for Chrome: Pomodoro, 52/17 or your own routine. A routine is a sequence of steps, such as 25 minutes of focus and 5 of break, that run back to back, with a notification at the end of every step. No site access, no account required.

[Website](https://ticktockfocus.com) · [Install from the Chrome Web Store](https://chromewebstore.google.com/detail/nealkefeifpkmkbfcfbkffdgnlohjbae)

## Features

- Routines of up to 20 steps of 30 seconds or more, each Focus, Break or Custom, with repeat groups (×2 to ×10) for cycles like Pomodoro; reorder steps by dragging or with the ↑/↓ buttons
- A progress ring split into the routine's steps and coloured by kind
- Pause, skip or add 5 minutes; the next step starts automatically or waits for you
- The minutes left in the current step on the toolbar icon, in the step's colour
- Notifications with buttons: pause or skip a step, start the next one or stop, and start a finished routine again
- A short sound at the end of each step (Chime, Bell or Soft) with its own volume, or none
- Keeps running with the popup closed. If the timer ended while Chrome was closed or the computer was asleep, one silent notification tells you when it finished
- Routines and settings sync across your computers when Chrome Sync is on
- Light and dark theme, 12- or 24-hour time, usable with just the keyboard

## Usage

1. On the **Routines** tab, click **New routine**, enter a name and add steps; **Add repeat group** adds a Focus and a Break step that repeat, and you can change them or add more. Click **Save**.
2. On the **Timer** tab, click a routine to start it. **Pause**, **Skip**, **+5 min** and **Stop** control the run. The toolbar icon shows the minutes left, **II** while paused and **▶** while the next step waits for you.
3. When a step ends, the notification's buttons pause, skip, start the next step or stop without opening the popup.
4. On the **Routines** tab, ▶ starts a routine and **⋯** edits, duplicates or deletes it.
5. **Settings** (⚙) chooses whether the next step starts automatically or waits for you, the time format, the sound and its volume (**Test** plays it), and whether the toolbar icon shows the time left.

## Development

There is no build step and there are no dependencies: the repository root is the unpacked extension. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and select the repository folder. Chrome 120 or later is required.

The unit tests for the shared logic run on Node's built-in test runner, with nothing to install: `npm test` (or `node --test`).

## Privacy

The extension uses only the `storage`, `alarms`, `notifications` and `offscreen` permissions. `offscreen` lets it play the end-of-step sound from a hidden extension page, because the background service worker can't play audio; that page only plays the sound files bundled with the extension and handles no data. Routines and settings live in Chrome's sync storage, so they follow your Google account when Chrome Sync is on; the running timer stays in your browser. There are no servers, tracking or analytics. When you remove the extension, Chrome opens a short page on ticktockfocus.com that asks for feedback; the extension sends nothing with it. See the [privacy policy](https://ticktockfocus.com/privacy.html).

## License

[Apache 2.0](LICENSE). The sounds are Creative Commons 0 recordings from Freesound; [sounds/README.md](sounds/README.md) lists their sources. Report bugs and ideas in [GitHub issues](https://github.com/mist941/tick-tock-focus/issues).
