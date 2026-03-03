/**
 * Babel Plugin: wp-block-grab JSX Source
 *
 * Injects source location tracking into JSX elements:
 * - Host elements (div, span, etc.): adds data-wp-source attribute
 * - React components (Placeholder, Button, etc.): adds data-wp-component-source attribute
 *
 * Source format: "plugins/plugin-name/path/to/file.js:line:column"
 *
 * The automatic JSX runtime strips __source props, so we use data-* attributes
 * which are preserved and accessible at runtime.
 */

const path = require( 'path' );

/**
 * Check if element name is a host element (lowercase HTML tags)
 *
 * @param {string} name - Element name
 * @return {boolean} True if host element
 */
function isHostElement( name ) {
	return (
		typeof name === 'string' &&
		name[ 0 ] === name[ 0 ].toLowerCase() &&
		name[ 0 ] !== '_'
	);
}

/**
 * Check if element name is a React component (capitalized)
 *
 * @param {string} name - Element name
 * @return {boolean} True if React component
 */
function isComponent( name ) {
	return typeof name === 'string' && name[ 0 ] === name[ 0 ].toUpperCase();
}

/**
 * Extract plugin/theme prefix from the current working directory.
 * Detects WordPress directory structure and extracts context.
 *
 * @param {string} cwd - Current working directory
 * @return {string} Prefix like "plugins/my-plugin" or "themes/my-theme", or empty string
 */
function getWordPressContextPrefix( cwd ) {
	const normalizedPath = cwd.replace( /\\/g, '/' );

	// Match /plugins/<plugin-name> anywhere in path (supports monorepo subdirectories)
	const pluginMatch = normalizedPath.match( /\/plugins\/([^/]+)/ );
	if ( pluginMatch ) {
		return `plugins/${ pluginMatch[ 1 ] }`;
	}

	// Match /themes/<theme-name> anywhere in path (supports nested theme structures)
	const themeMatch = normalizedPath.match( /\/themes\/([^/]+)/ );
	if ( themeMatch ) {
		return `themes/${ themeMatch[ 1 ] }`;
	}

	return '';
}

/**
 * Babel plugin factory
 */
module.exports = function( { types: t } ) {
	return {
		name: 'wp-block-grab-jsx-source',

		visitor: {
			JSXOpeningElement( nodePath, state ) {
				const nameNode = nodePath.node.name;

				// Only process JSX identifiers (not member expressions like Foo.Bar)
				if ( ! t.isJSXIdentifier( nameNode ) ) {
					return;
				}

				const elementName = nameNode.name;
				const isHost = isHostElement( elementName );
				const isComp = isComponent( elementName );

				// Skip if neither host element nor component
				if ( ! isHost && ! isComp ) {
					return;
				}

				// Determine attribute name based on element type
				// Both use data-* format to avoid React warnings when props spread to DOM
				const attrName = isHost ? 'data-wp-source' : 'data-wp-component-source';

				// Skip if attribute already exists
				const hasAttribute = nodePath.node.attributes.some(
					( attr ) =>
						t.isJSXAttribute( attr ) &&
						t.isJSXIdentifier( attr.name ) &&
						attr.name.name === attrName
				);

				if ( hasAttribute ) {
					return;
				}

				// Get source location
				const location = nodePath.node.loc;
				if ( ! location ) {
					return;
				}

				// Calculate file path
				const fileName = state.filename || 'unknown';
				const cwd = state.cwd || process.cwd();

				// Add WordPress context prefix (plugins/plugin-name or themes/theme-name).
				// Compute path relative to the plugin/theme root (not cwd) to handle
				// subdirectory builds (e.g., monorepo packages/blocks/ within a plugin).
				const wpPrefix = getWordPressContextPrefix( cwd );
				let fullPath;
				if ( wpPrefix ) {
					const normalizedCwd = cwd.replace( /\\/g, '/' );
					const prefixIndex = normalizedCwd.indexOf( wpPrefix );
					if ( prefixIndex >= 0 ) {
						const wpRoot = normalizedCwd.substring( 0, prefixIndex + wpPrefix.length );
						fullPath = wpPrefix + '/' + path.relative( wpRoot, fileName ).replace( /\\/g, '/' );
					} else {
						fullPath = wpPrefix + '/' + path.relative( cwd, fileName ).replace( /\\/g, '/' );
					}
				} else {
					fullPath = path.relative( cwd, fileName ).replace( /\\/g, '/' );
				}

				// Create source value: "path/to/file.js:line:column"
				const sourceValue = `${ fullPath }:${ location.start.line }:${ location.start.column + 1 }`;

				// Create and add the attribute
				const sourceAttribute = t.jsxAttribute(
					t.jsxIdentifier( attrName ),
					t.stringLiteral( sourceValue )
				);

				nodePath.node.attributes.push( sourceAttribute );
			}
		}
	};
};
