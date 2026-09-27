# Timetable

A very simple weekly planner for macOS. Build a typical week out of reusable
activities, save it as a template, and stamp it onto upcoming weeks.

## Using it

- **Drag an activity** from the left sidebar onto the week to place it.
- **Drag on empty space** to create a block of any length.
- **Drag a block** to move it, or drag its bottom edge to resize. Hold ⌥ while dropping to copy.
- **Click a block** to rename, recolour, change its times or delete it.
- **Week templates ▾**: save the current week as a template, apply a template to the
  week you're viewing, copy last week, or clear the week.
- **Sync with Calendar** (next to the week title) shows that week's Apple Calendar events. They keep
  updating by themselves; anything of yours that clashes with an event gets a red outline and ⚠.
- ⌘Z / ⇧⌘Z undo and redo.
- Your plans are saved automatically in Documents › Timetable Plans, with a daily backup.

## Development

Requirements: Node 20+, Rust 1.90+, Xcode Command Line Tools.

```bash
npm install
npm run dev          # browser-only, http://localhost:1420 (data in localStorage)
npm run app:dev      # native Tauri window with hot reload
npm run app:build    # builds Timetable.app + .dmg into src-tauri/target/release/bundle/
```

See [STATUS.md](STATUS.md) for architecture and roadmap.
