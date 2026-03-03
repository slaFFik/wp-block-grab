/**
 * WordPress Block Inspector
 *
 * Extracts contextual information about WordPress blocks
 * from the clicked element using the block editor data stores.
 */

/**
 * Get WordPress block information for an element
 *
 * @param {HTMLElement} element - The DOM element to inspect
 * @return {Object|null} Block information or null if not found
 */
export function getBlockInfo( element ) {
	// Check if WordPress data stores are available
	if ( typeof wp === 'undefined' || ! wp.data ) {
		return null;
	}

	const blockEditor = wp.data.select( 'core/block-editor' );
	if ( ! blockEditor ) {
		return null;
	}

	// Check if element is in the inspector sidebar
	const isInspector = element.closest( '.block-editor-block-inspector' ) !== null;

	let clientId;
	let block;

	// Find the block wrapper element
	const blockElement = element.closest( '[data-block]' );

	if ( blockElement ) {
		clientId = blockElement.getAttribute( 'data-block' );
		block = clientId ? blockEditor.getBlock( clientId ) : null;
	}

	// If in inspector or no block found, try to get the selected block
	if ( ! block && ( isInspector || ! blockElement ) ) {
		clientId = blockEditor.getSelectedBlockClientId();
		block = clientId ? blockEditor.getBlock( clientId ) : null;
	}

	if ( ! block ) {
		return null;
	}

	// Get block type info
	const blockTypes = wp.data.select( 'core/blocks' );
	const blockType = blockTypes?.getBlockType( block.name );

	// Build block info object
	const info = {
		blockName: block.name,
		blockTitle: blockType?.title || block.name,
		clientId,
		isInspector
	};

	// Add control context if in inspector
	if ( isInspector ) {
		const controlContext = getControlContext( element );
		if ( controlContext ) {
			info.controlContext = controlContext;
		}
	}

	return info;
}

/**
 * Get control context for inspector sidebar elements
 *
 * @param {HTMLElement} element - The DOM element
 * @return {Object|null} Control context or null
 */
function getDirectTextContent( element ) {
	let text = '';
	for ( const node of element.childNodes ) {
		if ( node.nodeType === Node.TEXT_NODE ) {
			text += node.textContent;
		}
	}
	return text.trim();
}

function getControlContext( element ) {
	const context = {};

	// Find parent panel
	const panel = element.closest( '.components-panel__body' );
	if ( panel ) {
		const panelButton = panel.querySelector( '.components-panel__body-toggle' );
		if ( panelButton ) {
			context.panelTitle = getDirectTextContent( panelButton );
		}
	}

	// Find associated label
	const controlWrapper = element.closest( '.components-base-control' );
	if ( controlWrapper ) {
		const label = controlWrapper.querySelector( '.components-base-control__label' );
		if ( label ) {
			context.labelText = getDirectTextContent( label );
		}
	}

	// Try to get current value
	const input = element.closest( 'input, select, textarea' ) ||
		element.querySelector( 'input, select, textarea' );
	if ( input ) {
		context.currentValue = input.value;
		context.controlType = input.tagName.toLowerCase();
		if ( input.type ) {
			context.controlType = input.type;
		}
	}

	return Object.keys( context ).length > 0 ? context : null;
}
