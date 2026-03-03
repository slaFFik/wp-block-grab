/**
 * Editor Canvas Iframe Utilities
 *
 * WordPress 6.3+ and the Site Editor render the block content canvas
 * inside an iframe (name="editor-canvas"). This module provides utilities
 * for detecting the iframe and translating coordinates.
 */

/**
 * Get the editor canvas iframe element, if present.
 *
 * @return {HTMLIFrameElement|null} The iframe element or null
 */
export function getEditorCanvasIframe() {
	return document.querySelector( 'iframe[name="editor-canvas"]' );
}

/**
 * Get the editor canvas iframe's contentDocument, if accessible.
 *
 * Returns null if the iframe is not present, not yet loaded,
 * or is cross-origin.
 *
 * @return {Document|null} The iframe's content document or null
 */
export function getEditorCanvasDocument() {
	const iframe = getEditorCanvasIframe();
	if ( ! iframe ) {
		return null;
	}
	try {
		return iframe.contentDocument || null;
	} catch ( e ) {
		// Cross-origin iframe
		return null;
	}
}

export function translateIframeRect( rect, iframe ) {
	const iframeRect = iframe.getBoundingClientRect();

	// Compute CSS transform scale. WP 6.5+ zoom-out mode applies
	// transform:scale() to the iframe. getBoundingClientRect() returns
	// post-transform dimensions, while rect from inside the iframe is
	// in unscaled CSS space. offsetWidth is pre-transform; ratio = 1.0
	// when no transform is applied.
	const scale = iframe.offsetWidth > 0
		? iframeRect.width / iframe.offsetWidth
		: 1;

	// Account for iframe border/padding (clientTop/clientLeft = border width)
	const borderTop = iframe.clientTop || 0;
	const borderLeft = iframe.clientLeft || 0;

	return {
		top: rect.top * scale + iframeRect.top + borderTop,
		left: rect.left * scale + iframeRect.left + borderLeft,
		bottom: rect.bottom * scale + iframeRect.top + borderTop,
		right: rect.right * scale + iframeRect.left + borderLeft,
		width: rect.width * scale,
		height: rect.height * scale,
	};
}
