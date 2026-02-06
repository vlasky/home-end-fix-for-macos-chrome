# Home/End Key Fix for macOS Chrome

![Version](https://img.shields.io/badge/version-1.0-blue)
![Licence](https://img.shields.io/badge/licence-MIT-green)

A Chrome extension that makes the Home and End keys behave like Windows inside text-editing fields when using a Windows keyboard on macOS.

This extension intercepts Home/End keypresses only inside text-editing fields and applies Windows-style behavior there - including line-level and field-level navigation with Shift and Ctrl.

## Motivation

I use a Razer BlackWidow V3 Pro mechanical keyboard - a Windows keyboard - with my M1 Pro Mac. Using the free [Karabiner-Elements](https://karabiner-elements.pqrs.org/) software and its [Windows shortcuts on macOS](https://ke-complex-modifications.pqrs.org/?q=Windows%20shortcuts%20on%20macOs#windows_shortcuts_on_macos) rules, I remapped most Windows hotkeys to their macOS equivalents. However, Karabiner didn't have the flexibility to emulate the complex behaviour of Home/End in Windows Chrome, which behaves differently depending on whether the cursor is inside or outside a text-editing field. This Chrome extension was the missing piece.

## Behavior

When a supported text-editing field is focused (`<textarea>`, `contenteditable`, or `<input>` types with selection APIs such as `text`, `search`, `url`, `tel`, and `password`):

| Keys | Action |
|---|---|
| Home | Move cursor to the start of the current line |
| End | Move cursor to the end of the current line |
| Shift+Home | Select from cursor to the start of the current line |
| Shift+End | Select from cursor to the end of the current line |
| Ctrl+Home | Move cursor to the start of the text field |
| Ctrl+End | Move cursor to the end of the text field |
| Ctrl+Shift+Home | Select from cursor to the start of the text field |
| Ctrl+Shift+End | Select from cursor to the end of the text field |

When focus is outside `<input>`, `<textarea>`, and `contenteditable` elements:

| Keys | Action |
|---|---|
| Home | Native Chrome behavior (typically scroll to top) |
| End | Native Chrome behavior (typically scroll to bottom) |

## Installation

1. Download or clone this repository
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (toggle in the top right)
4. Click **Load unpacked** and select this directory

Also works with other Chromium-based browsers that support Manifest V3, such as Edge, Brave, and Opera.

## Usage

The extension is enabled by default and works on all web pages. Click the extension icon in the toolbar to toggle it on or off. The badge shows "OFF" when disabled.

## How It Works

- A content script listens for `keydown` events in the capture phase on all pages and frames
- Event targets and deep active elements are used to detect focused fields (including elements inside Shadow DOM)
- `preventDefault()` is used only when handling Home/End inside supported text-editing fields
- For `<input>` elements, `setSelectionRange()` is used to move the cursor
- For `<textarea>` elements, a hidden mirror `<div>` with matching text layout properties is used to detect visual line boundaries (handling soft-wrapped lines correctly)
- For `contenteditable` elements, `Selection.modify()` handles visual line boundaries and `Selection.setBaseAndExtent()` handles field-level navigation
- For input types that do not expose selection APIs, browser-native Home/End behavior is preserved
- Outside text-editing fields, behavior is left entirely to Chrome

## Author

Vlad Lasky

## Licence

This project is released under the [MIT Licence](LICENCE).
