# TickTockFocus

<img src="icons/icon128.png" alt="" width="64" align="right">

A multi-step focus timer for Chrome: Pomodoro, 52/17 or your own routine. A routine is a sequence of steps, such as 25 minutes of focus and 5 of break, that run back to back, with a notification at the end of every step. No site access, no account required.

[Website](https://ticktockfocus.com) · [Install from the Chrome Web Store](https://chromewebstore.google.com/detail/nealkefeifpkmkbfcfbkffdgnlohjbae)

## Features

- Routines of up to 20 steps of 30 seconds or more, each Focus, Break or Custom, with repeat groups (×2 to ×10) for cycles like Pomodoro; reorder steps by dragging or with the ↑/↓ buttons
- A progress ring split into the routine's steps and coloured by kind
- Pause, skip or add 5 minutes; the next step starts automatically or waits for you
- Keeps running with the popup closed. If the timer ended while Chrome was closed or the computer was asleep, one notification tells you when it finished
- Routines and settings sync across your computers when Chrome Sync is on
- Light and dark theme, 12- or 24-hour time, usable with just the keyboard

## Usage

1. On the **Routines** tab, click **New routine**, enter a name and add steps; **Add repeat group** repeats the steps inside it. Click **Save**.
2. On the **Timer** tab, click a routine to start it. **Pause**, **Skip**, **+5 min** and **Stop** control the run.
3. On the **Routines** tab, ▶ starts a routine and **⋯** edits, duplicates or deletes it.
4. **Settings** (⚙) chooses whether the next step starts automatically or waits for you, and the time format.

## Development

There is no build step and there are no dependencies: the repository root is the unpacked extension. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and select the repository folder. Chrome 120 or later is required.

The unit tests for the shared logic run on Node's built-in test runner, with nothing to install: `npm test` (or `node --test`).

## Privacy

The extension uses only the `storage`, `alarms` and `notifications` permissions. Routines and settings live in Chrome's sync storage, so they follow your Google account when Chrome Sync is on; the running timer stays in your browser. There are no servers, tracking or analytics. When you remove the extension, Chrome opens a short page on ticktockfocus.com that asks for feedback; the extension sends nothing with it. See the [privacy policy](https://ticktockfocus.com/privacy.html).

## License

[Apache 2.0](LICENSE). Report bugs and ideas in [GitHub issues](https://github.com/mist941/tick-tock-focus/issues).
