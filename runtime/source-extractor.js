/**
 * Source Extractor
 *
 * Pure utility functions for extracting source location information
 * from DOM elements and React fiber tree. No React or UI dependencies.
 */

/**
 * Get React fiber from a DOM element
 *
 * @param {HTMLElement} element - DOM element
 * @return {Object|null} React fiber or null
 */
export function getFiberFromElement( element ) {
	const key = Object.keys( element ).find(
		( k ) => k.startsWith( '__reactFiber$' ) || k.startsWith( '__reactInternalInstance$' )
	);
	return key ? element[ key ] : null;
}

/**
 * Get React component name from fiber
 *
 * @param {Object} fiber - React fiber
 * @return {string|null} Component name or null
 */
export function getComponentName( fiber ) {
	if ( ! fiber?.type ) {
		return null;
	}
	// Function/class components
	if ( typeof fiber.type === 'function' ) {
		return fiber.type.displayName || fiber.type.name || null;
	}
	// React.memo-wrapped components
	if ( fiber.type?.$$typeof === Symbol.for( 'react.memo' ) ) {
		const inner = fiber.type.type;
		if ( typeof inner === 'function' ) {
			return fiber.type.displayName || inner.displayName || inner.name || null;
		}
		// memo(forwardRef(...)) — check inner.displayName (the forwardRef wrapper's name)
		if ( inner?.render ) {
			return fiber.type.displayName || inner.displayName || inner.render.displayName || cleanForwardRefName( inner.render.name ) || null;
		}
		return fiber.type.displayName || null;
	}
	// Forwarded refs — check outer displayName, then clean inner function name
	if ( fiber.type?.render ) {
		return fiber.type.displayName || fiber.type.render.displayName || cleanForwardRefName( fiber.type.render.name ) || null;
	}
	return null;
}

/**
 * Clean up WordPress forwardRef naming convention.
 * @wordpress/components names inner functions "UnforwardedX" (e.g.,
 * UnforwardedPanelBody, UnforwardedTextControl). Strip the prefix
 * to show the public component name developers actually use in JSX.
 *
 * @param {string|null} name - Function name
 * @return {string|null} Cleaned name
 */
function cleanForwardRefName( name ) {
	if ( ! name ) {
		return null;
	}
	if ( name.startsWith( 'Unforwarded' ) ) {
		return name.slice( 11 ) || name;
	}
	return name;
}

/**
 * Parse source string into object
 *
 * @param {string} source - Source string in format "path:line:column"
 * @return {Object|null} Parsed source info or null
 */
export function parseSourceString( source ) {
	if ( ! source ) {
		return null;
	}
	const parts = source.split( ':' );
	if ( parts.length >= 2 ) {
		const columnNumber = parts.length >= 3 ? parseInt( parts.pop(), 10 ) : 1;
		const lineNumber = parseInt( parts.pop(), 10 );
		if ( ! Number.isFinite( lineNumber ) || ! Number.isFinite( columnNumber ) ) {
			return null;
		}
		const fileName = parts.join( ':' );
		return { fileName, lineNumber, columnNumber };
	}
	return null;
}

/**
 * Walk up the React fiber tree to find component names and source locations
 *
 * @param {HTMLElement} element - Starting DOM element
 * @return {Object} Component path info with sources
 */
export function getComponentPathWithSources( element ) {
	const components = [];
	const componentSources = new Map();
	let fiber = getFiberFromElement( element );
	let closestComponentSource = null;

	while ( fiber ) {
		const name = getComponentName( fiber );
		if ( name && ! components.includes( name ) ) {
			components.push( name );

			// Check for data-wp-component-source prop (injected by Babel plugin)
			const wpSource =
				fiber.memoizedProps?.[ 'data-wp-component-source' ] ||
				fiber.pendingProps?.[ 'data-wp-component-source' ];

			if ( wpSource ) {
				const parsed = parseSourceString( wpSource );
				if ( parsed ) {
					componentSources.set( name, parsed );
					if ( ! closestComponentSource ) {
						closestComponentSource = { name, ...parsed };
					}
				}
			}
		}
		fiber = fiber.return;
	}

	return { components, componentSources, closestComponentSource };
}

/**
 * Get source info from DOM element
 *
 * @param {HTMLElement} element - The DOM element to inspect
 * @return {Object} Source information
 */
export function getSourceFromElement( element ) {
	const clickedTag = element.tagName?.toLowerCase();
	const { components, closestComponentSource } = getComponentPathWithSources( element );

	// Walk up DOM tree looking for data-wp-source
	let domSource = null;
	let current = element;
	let depth = 0;
	const rootBody = element.ownerDocument?.body || document.body;

	while ( current && current !== rootBody ) {
		const source = current.getAttribute?.( 'data-wp-source' );
		if ( source ) {
			const parsed = parseSourceString( source );
			if ( parsed ) {
				domSource = {
					...parsed,
					elementTag: current.tagName?.toLowerCase(),
					depth
				};
				break;
			}
		}
		current = current.parentElement;
		depth++;
	}

	// Prefer component source if available (more specific)
	if ( closestComponentSource ) {
		return {
			fileName: closestComponentSource.fileName,
			lineNumber: closestComponentSource.lineNumber,
			columnNumber: closestComponentSource.columnNumber,
			componentName: closestComponentSource.name,
			clickedTag: depth > 0 ? clickedTag : null,
			componentPath: components.length > 0 ? components : null,
			domSource
		};
	}

	// Fall back to DOM source
	if ( domSource ) {
		return {
			fileName: domSource.fileName,
			lineNumber: domSource.lineNumber,
			columnNumber: domSource.columnNumber,
			elementTag: domSource.elementTag,
			clickedTag: domSource.depth > 0 ? clickedTag : null,
			componentPath: components.length > 0 ? components : null,
			depth: domSource.depth
		};
	}

	return {
		clickedTag,
		componentPath: components.length > 0 ? components : null
	};
}
