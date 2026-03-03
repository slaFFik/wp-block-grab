/**
 * wp-block-grab Runtime
 *
 * This module is automatically injected into the bundle during development
 * and provides the source tracking UI:
 *
 * 1. Element selection overlay with highlighting
 * 2. Source location display (file + line number)
 * 3. WordPress block context integration
 * 4. User intent input for AI agents
 * 5. Formatted output for clipboard
 *
 * Keyboard shortcut: Cmd+Shift+S (Mac) / Ctrl+Shift+S (Windows/Linux)
 */

import { registerPlugin, getPlugins } from '@wordpress/plugins';
import { PluginMoreMenuItem } from '@wordpress/editor';
import { useState, useEffect, useCallback } from '@wordpress/element';
import { SourceOverlay } from './overlay';
import { createStore } from './store';
import { getEditorCanvasIframe, getEditorCanvasDocument } from './editor-canvas';

// Reuse existing store across HMR cycles; create new one only on first load
const store = ( typeof window !== 'undefined' && window.__wpBlockGrab ) || createStore();

/**
 * Plugin menu item component
 */
const GrabMenuItem = () => {
	const [ isActive, setIsActive ] = useState( () => store.getState().isActive );

	useEffect( () => {
		return store.subscribe( ( state ) => {
			setIsActive( state.isActive );
		} );
	}, [] );

	const toggleTracking = useCallback( () => {
		store.setState( { isActive: ! store.getState().isActive } );
	}, [] );

	return (
		<PluginMoreMenuItem
			icon={ null }
			shortcut={ window.navigator?.platform?.includes( 'Mac' ) ? '⌘⇧S' : 'Ctrl+Shift+S' }
			onClick={ toggleTracking }
		>
			{ isActive ? '✓ ' : '' }Grab Source
		</PluginMoreMenuItem>
	);
};

/**
 * Main plugin component that renders the overlay
 */
const GrabPlugin = () => {
	const [ isActive, setIsActive ] = useState( () => store.getState().isActive );

	useEffect( () => {
		return store.subscribe( ( state ) => {
			setIsActive( state.isActive );
		} );
	}, [] );

	// Keyboard shortcut: Cmd/Ctrl + Shift + S
	useEffect( () => {
		const handleKeyDown = ( event ) => {
			// Use event.code for physical key detection (works across keyboard layouts)
			if ( ( event.metaKey || event.ctrlKey ) && event.shiftKey && event.code === 'KeyS' ) {
				event.preventDefault();
				store.setState( { isActive: ! store.getState().isActive } );
			}
			// Escape to close
			if ( event.key === 'Escape' && store.getState().isActive ) {
				store.setState( { isActive: false } );
			}
		};

		document.addEventListener( 'keydown', handleKeyDown );

		// Also listen on editor canvas iframe (WP 6.3+, Site Editor).
		// Track both iframe element and its document to detect replacements
		// and handle the gap when a new iframe's contentDocument isn't ready yet.
		let currentIframe = null;
		let iframeDoc = null;

		const attachToIframe = () => {
			const iframe = getEditorCanvasIframe();

			// If iframe element changed or was removed, detach from old doc
			if ( iframe !== currentIframe ) {
				if ( iframeDoc ) {
					iframeDoc.removeEventListener( 'keydown', handleKeyDown );
					iframeDoc = null;
				}
				if ( currentIframe ) {
					currentIframe.removeEventListener( 'load', attachToIframe );
				}
				currentIframe = iframe;
				if ( iframe ) {
					iframe.addEventListener( 'load', attachToIframe );
				}
			}

			// Attach to new document if available
			const doc = iframe ? getEditorCanvasDocument() : null;
			if ( doc && doc !== iframeDoc ) {
				if ( iframeDoc ) {
					iframeDoc.removeEventListener( 'keydown', handleKeyDown );
				}
				iframeDoc = doc;
				iframeDoc.addEventListener( 'keydown', handleKeyDown );
			}
		};

		attachToIframe();
		const observer = new MutationObserver( attachToIframe );
		observer.observe( document.body, { childList: true, subtree: true } );

		return () => {
			document.removeEventListener( 'keydown', handleKeyDown );
			observer.disconnect();
			if ( iframeDoc ) {
				iframeDoc.removeEventListener( 'keydown', handleKeyDown );
			}
			if ( currentIframe ) {
				currentIframe.removeEventListener( 'load', attachToIframe );
			}
		};
	}, [] );

	if ( ! isActive ) {
		return null;
	}

	return <SourceOverlay store={ store } />;
};

// Register plugin (skip if already registered by another bundle)
const isAlreadyRegistered = getPlugins().some(
	( plugin ) => plugin.name === 'wp-block-grab'
);

if ( ! isAlreadyRegistered ) {
	// Expose store globally for debugging (only for the active instance)
	if ( typeof window !== 'undefined' ) {
		window.__wpBlockGrab = store;
	}

	try {
		registerPlugin( 'wp-block-grab', {
			render: () => (
				<>
					<GrabMenuItem />
					<GrabPlugin />
				</>
			)
		} );
	} catch ( e ) {
		// Already registered by another bundle (async race condition)
	}
}
