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
- `webpack.config.cjs` — Extends `@wordpress/scripts` default config, injects runtime entry (editor entries only, skips entries matching `^(view|render|frontend|script)([-.]|$)`), handles both function and object entry shapes, adds Babel plugin to all babel-loader instances via recursive rule traversal (walks `use`, `oneOf`, and nested `rules`), and carves the runtime directory out of babel-loader's `/node_modules/` exclude so raw JSX in `runtime/` transpiles when consumed from `node_modules/wp-block-grab/runtime/` (emits a warn if no matching rule is found)

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

No build step or linter is configured. Runtime, Babel plugin, CLI, and webpack-config files are authored directly and published as-is (tests are excluded via `files` in `package.json`).

To test changes against a real consumer plugin, add a `file:` dependency in the consumer's `package.json`:

```json
"devDependencies": {
  "wp-block-grab": "file:../../wp-block-grab"
}
```

Then run `npm install && npm start` in the consumer. **Important:** npm *copies* `file:` dependencies into `node_modules` rather than symlinking, so after editing `wp-block-grab` you must re-run `npm install` (or `rm -rf node_modules/wp-block-grab && npm install`) to pick up changes.

### Testing

Tests use Jest via `@wordpress/scripts` (devDependency). Run:

```bash
npm test              # Run all tests once
npm run test:watch    # Run in watch mode
npm test -- --coverage  # Run with coverage report
```

Test files live next to their source files (`*.test.js`). The test suite covers pure-function modules: `store`, `source-extractor`, `output-formatter`, `editor-canvas`, `babel/plugin-jsx-source`, and `config/webpack-utils`.

`config/webpack-utils.cjs` contains utility functions extracted from `webpack.config.cjs` for testability (`isFrontendEntry`, `injectRuntime`, `addBabelPluginToLoader`, `findAndPatchBabelLoader`, `patchExcludeForRuntime`).

Jest and Babel are configured at the repo root:
- `jest.config.js` — `testEnvironment: 'jsdom'`, `testMatch: <rootDir>/**/*.test.js`, babel-jest transform, no `node_modules` transform
- `babel.config.js` — uses `@wordpress/babel-preset-default` for test-time transforms only. The shipped runtime is untranspiled; it relies on the consumer's `@wordpress/scripts` Babel pipeline at build time (which is why `config/webpack.config.cjs` has to carve `runtime/` out of babel-loader's `/node_modules/` exclude).

## CI & Release

Two GitHub Actions workflows under `.github/workflows/`:

- `tests.yml` — Runs `npm test` on push to `main` and on PRs touching `*.js`/`*.cjs`.
- `publish.yml` — Triggered by pushing a semver tag matching `[0-9]*.[0-9]*.[0-9]*` (or via `workflow_dispatch`). Uses Node 22 with npm trusted publishing (OIDC, `id-token: write`) and `npm publish --provenance`. `prepublishOnly` in `package.json` runs the test suite first.

Release flow: bump `version` in `package.json`, commit, then `git tag X.Y.Z && git push origin X.Y.Z`. The tag push triggers the CI-driven publish — do not `npm publish` locally.
