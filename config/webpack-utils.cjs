/**
 * wp-block-grab Webpack Utilities
 *
 * Pure helper functions for webpack config manipulation.
 * Extracted from webpack.config.cjs for testability.
 */

/**
 * Check if an entry name indicates a frontend-only script.
 *
 * Entry names that match indicate frontend-only scripts (from block.json
 * viewScript, viewScriptModule, etc.). These run on the public frontend
 * where editor globals (@wordpress/plugins, @wordpress/editor) are not
 * available.
 *
 * @param {string} key - Webpack entry name (may contain path separators)
 * @return {boolean} True if the entry is frontend-only
 */
function isFrontendEntry( key ) {
	const name = key.split( '/' ).pop();
	return /^(view|render|frontend|script)([-.]|$)/.test( name );
}

/**
 * Inject runtime entry into each non-frontend webpack entry.
 *
 * Mutates the entries object in place.
 *
 * @param {Object} entries          - Webpack entries object
 * @param {string} runtimeEntryPath - Absolute path to the runtime entry file
 */
function injectRuntime( entries, runtimeEntryPath ) {
	Object.keys( entries ).forEach( ( key ) => {
		// Skip frontend-only entries — runtime requires editor globals
		if ( isFrontendEntry( key ) ) {
			return;
		}
		const entry = entries[ key ];
		if ( typeof entry === 'string' ) {
			entries[ key ] = { import: [ runtimeEntryPath, entry ] };
		} else if ( Array.isArray( entry ) ) {
			entries[ key ] = { import: [ runtimeEntryPath, ...entry ] };
		} else if ( typeof entry === 'object' && entry.import ) {
			const imports = Array.isArray( entry.import ) ? entry.import : [ entry.import ];
			entry.import = [ runtimeEntryPath, ...imports ];
		}
	} );
}

/**
 * Add Babel plugin to babel-loader instances in a loaders array.
 *
 * @param {Array}  loaders    - Array of webpack loader entries
 * @param {string} pluginPath - Absolute path to the Babel plugin
 * @return {boolean} True if at least one babel-loader was patched
 */
function addBabelPluginToLoader( loaders, pluginPath ) {
	let found = false;
	for ( let i = 0; i < loaders.length; i++ ) {
		const loader = loaders[ i ];
		const loaderPath = typeof loader === 'string' ? loader : loader?.loader;

		if ( loaderPath && loaderPath.includes( 'babel-loader' ) ) {
			if ( typeof loader === 'string' ) {
				loaders[ i ] = {
					loader,
					options: { plugins: [ pluginPath ] }
				};
			} else {
				if ( ! loader.options ) {
					loader.options = {};
				}
				if ( ! loader.options.plugins ) {
					loader.options.plugins = [];
				}
				loader.options.plugins.push( pluginPath );
			}
			found = true;
		}
	}
	return found;
}

/**
 * Recursively find and patch babel-loader in webpack rules.
 *
 * Walks rules (including oneOf and nested rules) to find babel-loader
 * in any config shape.
 *
 * @param {Array}  rules      - Webpack module rules array
 * @param {string} pluginPath - Absolute path to the Babel plugin
 * @return {boolean} True if at least one babel-loader was patched
 */
function findAndPatchBabelLoader( rules, pluginPath ) {
	let found = false;
	for ( const rule of rules ) {
		// Check rule.use array (most common shape)
		if ( Array.isArray( rule.use ) ) {
			if ( addBabelPluginToLoader( rule.use, pluginPath ) ) {
				found = true;
			}
		}

		// Check single loader in rule.loader
		if ( typeof rule.loader === 'string' && rule.loader.includes( 'babel-loader' ) ) {
			if ( ! rule.options ) {
				rule.options = {};
			}
			if ( ! rule.options.plugins ) {
				rule.options.plugins = [];
			}
			rule.options.plugins.push( pluginPath );
			found = true;
		}

		// Recurse into oneOf rules
		if ( Array.isArray( rule.oneOf ) ) {
			if ( findAndPatchBabelLoader( rule.oneOf, pluginPath ) ) {
				found = true;
			}
		}

		// Recurse into nested rules
		if ( Array.isArray( rule.rules ) ) {
			if ( findAndPatchBabelLoader( rule.rules, pluginPath ) ) {
				found = true;
			}
		}
	}
	return found;
}

module.exports = {
	isFrontendEntry,
	injectRuntime,
	addBabelPluginToLoader,
	findAndPatchBabelLoader,
};
