/**
 * Output Formatter
 *
 * Formats the collected source information into a compact format
 * optimized for AI coding agents.
 */

/**
 * Normalize multiline text to single line
 *
 * @param {string} text - The text to normalize
 * @return {string} Single-line normalized text
 */
function normalizeToSingleLine( text ) {
	if ( ! text ) {
		return '';
	}
	return text
		.split( /\r?\n/ )
		.map( ( line ) => line.trim() )
		.filter( ( line ) => line.length > 0 )
		.join( ' ' );
}

/**
 * Build a CSS-selector-like string for a DOM element (tag.class1.class2)
 *
 * @param {HTMLElement} element - The DOM element
 * @return {string|null} Selector string or null
 */
function getElementSelector( element ) {
	const tag = element.tagName?.toLowerCase();
	if ( ! tag ) {
		return null;
	}

	const className = element.className;
	if ( ! className || typeof className !== 'string' ) {
		return tag;
	}

	const classes = className.trim().split( /\s+/ ).filter( ( c ) => c.length > 0 );
	if ( classes.length === 0 ) {
		return tag;
	}

	// Show up to 5 classes to keep output concise
	const shown = classes.slice( 0, 5 );
	let selector = tag + '.' + shown.join( '.' );
	if ( classes.length > 5 ) {
		selector += ' (+' + ( classes.length - 5 ) + ')';
	}
	return selector;
}

/**
 * Format source info for AI agents
 *
 * @param {Object} sourceInfo - The collected source information
 * @param {string} intent     - User's intent/description
 * @return {string} Formatted output for clipboard
 */
export function formatOutput( sourceInfo, intent ) {
	const { debugSource, blockInfo, element } = sourceInfo;

	const lines = [];

	lines.push( '<source_context>' );

	// Intent (normalized to single line)
	const normalizedIntent = normalizeToSingleLine( intent );
	if ( normalizedIntent ) {
		lines.push( `Intent: ${ normalizedIntent }` );
	}

	// Location (file:line with component name)
	if ( debugSource?.fileName ) {
		let location = `${ debugSource.fileName }:${ debugSource.lineNumber }`;
		if ( debugSource.componentName ) {
			location += ` (<${ debugSource.componentName }>)`;
		}
		lines.push( `Location: ${ location }` );
	}

	// Component hierarchy (parent > child order, up to 5 nearest components)
	if ( debugSource?.componentPath?.length > 1 ) {
		const nearest = debugSource.componentPath.slice( 0, 5 );
		lines.push( `Component path: ${ [ ...nearest ].reverse().join( ' > ' ) }` );
	}

	// Block context
	if ( blockInfo?.blockName ) {
		lines.push( `Block: ${ blockInfo.blockName }` );
	}

	// Inspector control context (panel title, label, current value)
	if ( blockInfo?.controlContext ) {
		const ctx = blockInfo.controlContext;
		if ( ctx.panelTitle ) {
			lines.push( `Panel: ${ ctx.panelTitle }` );
		}
		if ( ctx.labelText ) {
			let control = ctx.labelText;
			if ( ctx.controlType ) {
				control += ` (${ ctx.controlType }`;
				if ( ctx.currentValue !== undefined && ctx.currentValue !== '' ) {
					control += `, current: ${ ctx.currentValue }`;
				}
				control += ')';
			}
			lines.push( `Control: ${ control }` );
		}
	}

	// Clicked element (CSS-selector-like format)
	if ( element ) {
		const selector = getElementSelector( element );
		if ( selector ) {
			lines.push( `Clicked: ${ selector }` );
		}
	}

	// Fallback when no source info available
	if ( ! debugSource?.fileName && ! blockInfo?.blockName ) {
		lines.push( 'Note: Source location not available. Build with wp-block-grab start.' );
	}

	lines.push( '</source_context>' );

	return lines.join( '\n' );
}
