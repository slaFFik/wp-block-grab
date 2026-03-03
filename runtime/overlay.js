/**
 * Source Overlay Component
 *
 * Renders the element selection overlay and handles:
 * - Mouse tracking and element highlighting
 * - Click to select and show details popover
 * - Editor canvas iframe coordinate translation
 */

import { useState, useEffect, useCallback, useRef, createPortal } from '@wordpress/element';

import { getBlockInfo } from './inspector';
import { IntentPopover } from './ui/intent-popover';
import { getEditorCanvasIframe, getEditorCanvasDocument, translateIframeRect } from './editor-canvas';
import { getSourceFromElement } from './source-extractor';

// Styles
const highlightStyles = {
	position: 'fixed',
	pointerEvents: 'none',
	border: '2px solid #007cba',
	backgroundColor: 'rgba(0, 124, 186, 0.1)',
	zIndex: 999999,
	transition: 'all 0.1s ease-out'
};

const labelStyles = {
	position: 'fixed',
	backgroundColor: '#007cba',
	color: 'white',
	padding: '2px 6px',
	fontSize: '11px',
	fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
	borderRadius: '2px',
	zIndex: 1000000,
	pointerEvents: 'none',
	whiteSpace: 'nowrap',
	maxWidth: '500px',
	overflow: 'hidden',
	textOverflow: 'ellipsis'
};

/**
 * Source Overlay Component
 */
export const SourceOverlay = ( { store } ) => {
	const [ highlight, setHighlight ] = useState( null );
	const [ selectedInfo, setSelectedInfo ] = useState( null );
	const [ popoverPosition, setPopoverPosition ] = useState( null );
	const iframeRef = useRef( null );
	const rafRef = useRef( null );
	const highlightRef = useRef( null );

	// Clean up pending animation frame on unmount
	useEffect( () => {
		return () => {
			if ( rafRef.current ) {
				cancelAnimationFrame( rafRef.current );
			}
		};
	}, [] );

	// Handle mouse move - highlight elements (throttled via requestAnimationFrame)
	const handleMouseMove = useCallback( ( event ) => {
		// Ignore our own overlay elements
		if ( event.target.closest?.( '[data-wp-block-grab]' ) ) {
			return;
		}

		// Throttle: skip if a frame is already pending
		if ( rafRef.current ) {
			return;
		}

		const element = event.target;

		rafRef.current = requestAnimationFrame( () => {
			rafRef.current = null;

			try {
				// Element may have been removed from DOM between event and RAF
				if ( ! element.isConnected ) {
					return;
				}

				const elementRect = element.getBoundingClientRect();

				// Translate coordinates if element is inside the editor canvas iframe
				const isInIframe = element.ownerDocument !== document;
				const rect = ( isInIframe && iframeRef.current )
					? translateIframeRect( elementRect, iframeRef.current )
					: elementRect;

				// Get source info
				const debugSource = getSourceFromElement( element );
				const blockInfo = getBlockInfo( element );

				// Build label - prefer component name for cleaner display
				let label = element.tagName.toLowerCase();
				if ( debugSource?.componentName ) {
					label = `<${ debugSource.componentName }>`;
				} else if ( debugSource?.fileName ) {
					// Extract just filename from path for shorter label
					const fileName = debugSource.fileName.split( '/' ).pop();
					label = `${ fileName }:${ debugSource.lineNumber }`;
				} else if ( blockInfo?.blockName ) {
					label = blockInfo.blockName;
				}

				const newHighlight = {
					rect,
					label,
					element,
					debugSource,
					blockInfo
				};

				highlightRef.current = newHighlight;
				setHighlight( newHighlight );
			} catch ( e ) {
				// Silently skip — next mousemove will try again
			}
		} );
	}, [] );

	// Handle click - select element and show popover
	const handleClick = useCallback( ( event ) => {
		// Ignore our own overlay elements
		if ( event.target.closest?.( '[data-wp-block-grab]' ) ) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();

		const currentHighlight = highlightRef.current;
		if ( currentHighlight ) {
			const rect = currentHighlight.rect;
			setSelectedInfo( currentHighlight );
			setPopoverPosition( {
				top: rect.bottom + 8,
				left: rect.left
			} );
		}
	}, [] );

	// Set up event listeners on main document and editor canvas iframe.
	// Uses MutationObserver + iframe load event to detect iframe appearance,
	// replacement (Site Editor navigation), and document readiness.
	useEffect( () => {
		document.addEventListener( 'mousemove', handleMouseMove, true );
		document.addEventListener( 'click', handleClick, true );

		// Track both iframe element and its document to handle:
		// - Iframe element replacement (MutationObserver detects this)
		// - Iframe document swap without element replacement (load event detects this)
		// - Premature contentDocument access (about:blank before real doc loads)
		let currentIframe = null;
		let currentIframeDoc = null;

		const attachToIframe = () => {
			const iframe = getEditorCanvasIframe();

			// If iframe element changed or was removed, detach from old doc
			if ( iframe !== currentIframe ) {
				if ( currentIframeDoc ) {
					currentIframeDoc.removeEventListener( 'mousemove', handleMouseMove, true );
					currentIframeDoc.removeEventListener( 'click', handleClick, true );
					currentIframeDoc = null;
				}
				if ( currentIframe ) {
					currentIframe.removeEventListener( 'load', attachToIframe );
				}
				currentIframe = iframe;
				iframeRef.current = iframe;
				if ( iframe ) {
					iframe.addEventListener( 'load', attachToIframe );
				}
			}

			// Attach to new document if available
			const doc = iframe ? getEditorCanvasDocument() : null;
			if ( doc && doc !== currentIframeDoc ) {
				if ( currentIframeDoc ) {
					currentIframeDoc.removeEventListener( 'mousemove', handleMouseMove, true );
					currentIframeDoc.removeEventListener( 'click', handleClick, true );
				}
				currentIframeDoc = doc;
				currentIframeDoc.addEventListener( 'mousemove', handleMouseMove, true );
				currentIframeDoc.addEventListener( 'click', handleClick, true );
			}
		};

		attachToIframe();
		const observer = new MutationObserver( attachToIframe );
		observer.observe( document.body, { childList: true, subtree: true } );

		return () => {
			document.removeEventListener( 'mousemove', handleMouseMove, true );
			document.removeEventListener( 'click', handleClick, true );
			observer.disconnect();
			if ( currentIframeDoc ) {
				currentIframeDoc.removeEventListener( 'mousemove', handleMouseMove, true );
				currentIframeDoc.removeEventListener( 'click', handleClick, true );
			}
			if ( currentIframe ) {
				currentIframe.removeEventListener( 'load', attachToIframe );
			}
		};
	}, [ handleMouseMove, handleClick ] );

	// Close popover
	const handleClosePopover = useCallback( () => {
		setSelectedInfo( null );
		setPopoverPosition( null );
	}, [] );

	// Copy handler
	const handleCopy = useCallback( ( text ) => {
		const onSuccess = () => {
			handleClosePopover();
			store.setState( { isActive: false } );
		};

		const fallbackCopy = () => {
			const textarea = document.createElement( 'textarea' );
			textarea.value = text;
			textarea.style.position = 'fixed';
			textarea.style.opacity = '0';
			document.body.appendChild( textarea );
			textarea.select();
			const success = document.execCommand( 'copy' );
			document.body.removeChild( textarea );

			if ( success ) {
				onSuccess();
			}
			// If both methods failed, leave popover open so user can copy manually
		};

		// navigator.clipboard is only available in secure contexts (HTTPS or localhost)
		if ( navigator.clipboard?.writeText ) {
			navigator.clipboard.writeText( text ).then( onSuccess ).catch( fallbackCopy );
		} else {
			fallbackCopy();
		}
	}, [ store, handleClosePopover ] );

	return createPortal(
		<div data-wp-block-grab="overlay">
			{ /* Highlight box */ }
			{ highlight && ! selectedInfo && (
				<>
					<div
						data-wp-block-grab="highlight"
						style={ {
							...highlightStyles,
							top: highlight.rect.top,
							left: highlight.rect.left,
							width: highlight.rect.width,
							height: highlight.rect.height
						} }
					/>
					<div
						data-wp-block-grab="label"
						style={ {
							...labelStyles,
							top: Math.max( 4, highlight.rect.top - 22 ),
							left: highlight.rect.left
						} }
					>
						{ highlight.label }
					</div>
				</>
			) }

			{ /* Selection popover */ }
			{ selectedInfo && popoverPosition && (
				<IntentPopover
					position={ popoverPosition }
					sourceInfo={ selectedInfo }
					onCopy={ handleCopy }
					onClose={ handleClosePopover }
				/>
			) }
		</div>,
		document.body
	);
};
