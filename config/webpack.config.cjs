/**
 * wp-block-grab Webpack Config
 *
 * Extends @wordpress/scripts default config to:
 * 1. Inject the runtime entry
 * 2. Add Babel plugin for source tracking
 */

// Resolve @wordpress/scripts from the plugin's directory (cwd), not from wp-block-grab
const wpScriptsConfigPath = require.resolve( '@wordpress/scripts/config/webpack.config', {
	paths: [ process.cwd() ]
} );
const defaultConfig = require( wpScriptsConfigPath );

const path = require( 'path' );
const { injectRuntime, findAndPatchBabelLoader, patchExcludeForRuntime } = require( './webpack-utils.cjs' );

const runtimeEntryPath = process.env.WP_BLOCK_GRAB_RUNTIME;
const babelPluginPath = process.env.WP_BLOCK_GRAB_BABEL_PLUGIN;

if ( ! runtimeEntryPath ) {
	throw new Error( 'WP_BLOCK_GRAB_RUNTIME environment variable is required' );
}

if ( ! babelPluginPath ) {
	throw new Error( 'WP_BLOCK_GRAB_BABEL_PLUGIN environment variable is required' );
}

const originalEntry = defaultConfig.entry;
if ( typeof originalEntry === 'function' ) {
	defaultConfig.entry = async function() {
		const entries = await originalEntry();
		injectRuntime( entries, runtimeEntryPath );
		return entries;
	};
} else if ( typeof originalEntry === 'object' && originalEntry !== null ) {
	injectRuntime( originalEntry, runtimeEntryPath );
} else {
	console.warn(
		'\x1b[33m%s\x1b[0m',
		'wp-block-grab: Unexpected entry type (' + typeof originalEntry + '). Runtime injection skipped.'
	);
}

if ( defaultConfig.module && defaultConfig.module.rules ) {
	const patched = findAndPatchBabelLoader( defaultConfig.module.rules, babelPluginPath );
	if ( ! patched ) {
		console.warn(
			'\x1b[33m%s\x1b[0m',
			'wp-block-grab: Could not find babel-loader in webpack config. Source tracking will not work.'
		);
	}

	// Allow runtime directory through babel-loader's node_modules exclude
	const runtimeDir = path.resolve( __dirname, '..', 'runtime' );
	const excludePatched = patchExcludeForRuntime( defaultConfig.module.rules, runtimeDir );
	if ( ! excludePatched ) {
		console.warn(
			'\x1b[33m%s\x1b[0m',
			'wp-block-grab: Could not patch babel-loader exclude for the runtime directory. JSX in runtime/ may fail to transpile.'
		);
	}
}

// Enable source maps for better debugging
defaultConfig.devtool = defaultConfig.devtool ?? 'eval-source-map';

module.exports = defaultConfig;
