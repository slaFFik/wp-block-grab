# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**wp-block-grab** is a developer tool that helps AI coding agents identify exact source file locations and line numbers when working with the WordPress Block Editor. It injects source tracking attributes into JSX during development builds and provides a runtime UI for extracting that context.

## Architecture

Two complementary components:

### 1. Babel Plugin (Build Time) — `babel/plugin-jsx-source.js`
- Injects `data-wp-source` attributes on host elements (HTML tags) and `data-wp-component-source` on React components during JSX compilation
- Format: `plugins/plugin-name/path/to/file.js:line:column`
- Detects WordPress context prefix (plugins/X or themes/X) from cwd, supports monorepo/nested subdirectories (computes paths relative to the plugin/theme root, not cwd)
- Skips JSX member expressions (e.g., `Foo.Bar`) and elements that already have the attribute
- CJS module

### 2. Runtime (Browser/Editor) — `runtime/`
- `index.js` — Registers as WordPress plugin via `@wordpress/plugins`, adds menu item with keyboard shortcut display and keyboard shortcut handler (Cmd/Ctrl+Shift+S), manages activation state via store singleton
- `overlay.js` — Highlights hovered elements (RAF-throttled with `isConnected` guard and try-catch), manages event listeners on main document and editor canvas iframe, handles coordinate translation for iframe elements
- `source-extractor.js` — Pure utility functions for extracting source locations from DOM attributes (`data-wp-source`) and React fiber tree (`data-wp-component-source`); handles React.memo and forwardRef-wrapped components (strips WordPress `Unforwarded` prefix convention via `cleanForwardRefName`); collects component path hierarchy; no React/UI dependencies
- `editor-canvas.js` — Detects the editor canvas iframe (`iframe[name="editor-canvas"]`, WP 6.3+, Site Editor), provides `getEditorCanvasDocument()` with cross-origin safety, and `translateIframeRect()` for scale-aware coordinate translation (handles WP 6.5+ zoom-out CSS transform and iframe border offsets)
- `inspector.js` — Extracts WordPress block metadata (block name, title, inspector panel/control context) via `wp.data` stores
- `store.js` — Simple observable state store with subscribe/unsubscribe pattern (not Redux), exposed as `window.__wpBlockGrab`; singleton across HMR cycles
- `output-formatter.js` — Generates `<source_context>` formatted output optimized for AI agents; includes intent, file location, component path hierarchy, block name, inspector control context (panel/label/value), and clicked element selector
- `ui/intent-popover.js` — Popover for user to describe intent before copying; supports Cmd/Ctrl+Enter to submit, Escape to close (with stopPropagation to prevent tool deactivation)
- All runtime files are ESM

### CLI Wrapper — `bin/wp-block-grab.js`
- Wraps `@wordpress/scripts` — `start` injects Babel plugin + webpack config + runtime; `build` passes through unchanged
- Communicates paths to child processes via env vars: `WP_BLOCK_GRAB_RUNTIME`, `WP_BLOCK_GRAB_BABEL_PLUGIN`
- Signal-aware exit codes (128 + signal number) via shared `forwardChildExit()` helper

### Config — `config/`
- `webpack.config.cjs` — Extends `@wordpress/scripts` default config, injects runtime entry (editor entries only, skips entries matching `^(view|render|frontend|script)([-.]|$)`), handles both function and object entry shapes, adds Babel plugin to all babel-loader instances via recursive rule traversal (walks `use`, `oneOf`, and nested `rules`)

## Key Constraints

- **No npm dependencies** — uses only peer dependency `@wordpress/scripts >= 26.0.0` and Node built-ins
- **Production safe** — `build` command is a clean pass-through to wp-scripts, no source tracking injected
- **Multiple bundle dedup** — Runtime auto-deduplicates via `getPlugins()` check + try-catch around `registerPlugin()`; only the first bundle's instance registers
- **HMR store persistence** — Store is a singleton via `window.__wpBlockGrab`; reused across HMR cycles to prevent orphaned stores and accumulating MutationObservers
- **React internals** — Source extractor accesses React fiber tree via `__reactFiber$` / `__reactInternalInstance$` keys; works across document boundaries (React's createPortal preserves unified fiber tree)
- **Iframe support** — Detects editor canvas iframe via MutationObserver + iframe `load` event; tracks both iframe element and its contentDocument separately to handle replacement (Site Editor navigation) and document readiness; translates coordinates with CSS transform scale awareness and border offset correction
- **Event capture phase** — DOM events (mousemove, click, keydown) are captured at document level with `true` flag
- **RAF throttle** — mousemove handler is throttled via `requestAnimationFrame` with `isConnected` guard and try-catch for robustness
- **Clipboard fallback** — Uses `navigator.clipboard.writeText` when available (secure contexts), falls back to `document.execCommand('copy')` for HTTP environments
- **Inline styles** — Overlay components use inline styles, no CSS files
- **Keyboard layout agnostic** — Uses `event.code` (physical key) instead of `event.key` for the activation shortcut
- Node.js >= 18.0.0 required

## Development

This package has no build step or linter configured yet. The code is authored directly as shipped. To test manually, install it as a dev dependency in a WordPress block plugin project and run `wp-block-grab start`.

### Testing

Tests use Jest via `@wordpress/scripts` (devDependency). Run:

```bash
npm test              # Run all tests once
npm run test:watch    # Run in watch mode
npm test -- --coverage  # Run with coverage report
```

Test files live next to their source files (`*.test.js`). The test suite covers pure-function modules: `store`, `source-extractor`, `output-formatter`, `editor-canvas`, `babel/plugin-jsx-source`, and `config/webpack-utils`.

`config/webpack-utils.cjs` contains utility functions extracted from `webpack.config.cjs` for testability (`isFrontendEntry`, `injectRuntime`, `addBabelPluginToLoader`, `findAndPatchBabelLoader`).
