# wp-block-grab

AI-ready context extraction for WordPress Block Editor.

**wp-block-grab** helps AI coding agents (like Claude, ChatGPT, Cursor, etc.) identify exact source file and line numbers when you click on any element in the WordPress Block Editor. No more guessing which file to edit!

## Features

- **Source Location Tracking** — Click any element to get the exact file path and line number
- **React Component Detection** — Identifies components by name (even through React.memo and forwardRef wrappers) and provides the full component hierarchy path
- **WordPress Block Context** — Automatically detects which block you're working with, including inspector panel and control context
- **Plugin/Theme Aware** — Paths include `plugins/your-plugin/` or `themes/your-theme/` prefix, with monorepo support
- **AI-Optimized Output** — Formatted `<source_context>` output ready to paste into AI coding assistants
- **Zero Production Overhead** — Only active during development (`start` command); `build` is a clean pass-through
- **Site Editor & Iframe Support** — Works in both Post Editor and Site Editor (WP 6.3+), including zoom-out mode (WP 6.5+)
- **Keyboard Shortcut** — Cmd+Shift+S (Mac) / Ctrl+Shift+S (Windows/Linux) to toggle; works across keyboard layouts
- **Intent Description** — Describe what you want to change before copying, so the AI agent has full context
- **Multi-Plugin Safe** — Automatically deduplicates when multiple plugins include it

## Requirements

- Node.js 18+
- `@wordpress/scripts` 26+ (peer dependency)

## Installation

```bash
npm install --save-dev wp-block-grab
```

## Setup

Replace `wp-scripts` with `wp-block-grab` in your `start` script:

```json
{
  "scripts": {
    "build": "wp-scripts build",
    "start": "wp-block-grab start"
  }
}
```

The `build` command uses vanilla `wp-scripts` for clean production builds. The `start` command enables source tracking for development.

All `@wordpress/scripts` options are passed through:

```json
{
  "scripts": {
    "start": "wp-block-grab start --webpack-src-dir=block/src --output-path=block/build"
  }
}
```

## How to Use

1. Run `npm run start` to start development with source tracking
2. Open the WordPress Block Editor
3. Press **Cmd+Shift+S** (Mac) or **Ctrl+Shift+S** (Windows/Linux) to activate
   - Or use the editor's **Options menu** (⋮) → **Grab Source**
4. Hover over any element — a blue highlight shows the source location
5. Click to select the element
6. Type what you want to change in the intent field
7. Click **Copy for AI** (or press **Cmd/Ctrl+Enter**) to copy formatted output
8. Paste into your AI coding assistant

Press **Escape** to close the popover or deactivate the tool.

## Output Format

When you copy, you get AI-optimized output like this:

```
<source_context>
Intent: Change the placeholder to "max"
Location: plugins/my-plugin/block/src/edit.js:101 (<TextControl>)
Component path: EditSettings > PanelBody > TextControl > BaseControl
Block: my-plugin/my-block
Panel: Width & Height
Control: Height (text, current: max)
Clicked: input.components-text-control__input
</source_context>
```

This gives AI coding agents everything needed to make precise edits:
- **Location** — exact file, line number, and React component name
- **Component path** — the React component hierarchy (parent > child)
- **Block** — which WordPress block the element belongs to
- **Panel / Control** — inspector sidebar context with current value (when clicking sidebar controls)
- **Clicked** — the actual DOM element in CSS-selector format

When source tracking data isn't available (e.g., for core WordPress elements not built with wp-block-grab), the output falls back to element and block information:

```
<source_context>
Intent: Make this button larger
Block: core/button
Clicked: button.wp-block-button__link.wp-element-button
Note: Source location not available. Build with wp-block-grab start.
</source_context>
```

## How It Works

### Babel Plugin (Build Time)

During development builds, a Babel plugin injects `data-wp-source` attributes into your JSX:

```jsx
// Your code
<div className="wrapper">

// Becomes (in dev build only)
<div className="wrapper" data-wp-source="plugins/my-plugin/src/edit.js:10:1">
```

React components get `data-wp-component-source` attributes, accessible via the React fiber tree:

```jsx
// Your code
<SaveButton onClick={save} />

// Becomes (in dev build only)
<SaveButton onClick={save} data-wp-component-source="plugins/my-plugin/src/edit.js:22:3" />
```

These attributes are only added during `wp-block-grab start`. Production builds via `wp-scripts build` (or `wp-block-grab build`) contain no tracking code.

### Runtime UI (Editor)

When activated, the runtime:
1. Highlights elements on hover with source info in a floating label
2. On click, extracts source data from `data-wp-source` DOM attributes and `data-wp-component-source` props via the React fiber tree
3. Queries WordPress data stores for block context (block name, inspector panel, control labels)
4. Presents a popover with location details and an intent input field
5. Formats everything into `<source_context>` output and copies to clipboard

The runtime handles both regular Post Editor and iframe-based Site Editor (WP 6.3+), automatically detecting and attaching to the editor canvas iframe. Coordinate translation accounts for CSS transform scaling in zoom-out mode (WP 6.5+).

## FAQ

### Does this affect production builds?

No. The `build` command passes through directly to `wp-scripts` without any modifications. Source tracking attributes and the runtime UI are only present during `start`.

### Why do I see "Source location not available"?

This happens when clicking on elements from code that wasn't built with wp-block-grab:
- WordPress core components
- Third-party libraries
- Plugins not using wp-block-grab

The tool will still show the WordPress block context (block name) when available.

### Can I use this with multiple plugins?

Yes. Each plugin can have wp-block-grab in its devDependencies. The runtime automatically deduplicates — only one instance registers even if multiple bundles include it.

### Does it work in the Site Editor?

Yes. wp-block-grab detects the editor canvas iframe used by the Site Editor (WP 6.3+) and the Post Editor (WP 6.3+ when iframe is enabled). It handles iframe navigation, document replacement, and CSS transform scaling in zoom-out mode.

### What about non-Latin keyboard layouts?

The keyboard shortcut uses physical key detection (`event.code`), so Cmd/Ctrl+Shift+S works regardless of your keyboard layout or input language.

## License

MIT
