/**
 * Intent Popover Component
 *
 * Shows source information and allows user to input
 * their intent for AI coding agents.
 */

import { useState, useCallback, useRef, useEffect } from '@wordpress/element';
import { Button, TextareaControl } from '@wordpress/components';

import { formatOutput } from '../output-formatter';

// Styles
const popoverStyles = {
	position: 'fixed',
	backgroundColor: 'white',
	border: '1px solid #ccc',
	borderRadius: '4px',
	boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
	padding: '12px',
	zIndex: 1000001,
	maxWidth: '450px',
	minWidth: '350px',
	fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
	fontSize: '13px'
};

const headerStyles = {
	display: 'flex',
	justifyContent: 'space-between',
	alignItems: 'center',
	marginBottom: '8px',
	paddingBottom: '8px',
	borderBottom: '1px solid #eee'
};

const titleStyles = {
	fontWeight: '600',
	fontSize: '14px',
	margin: 0
};

const sectionStyles = {
	marginBottom: '12px'
};

const labelStyles = {
	fontSize: '11px',
	color: '#666',
	textTransform: 'uppercase',
	letterSpacing: '0.5px',
	marginBottom: '4px'
};

const valueStyles = {
	fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
	fontSize: '12px',
	backgroundColor: '#f5f5f5',
	padding: '4px 8px',
	borderRadius: '3px',
	wordBreak: 'break-all'
};

const buttonRowStyles = {
	display: 'flex',
	gap: '8px',
	justifyContent: 'flex-end',
	marginTop: '12px'
};

/**
 * Intent Popover Component
 */
export const IntentPopover = ( { position, sourceInfo, onCopy, onClose } ) => {
	const [ intent, setIntent ] = useState( '' );
	const textareaWrapperRef = useRef( null );

	// Focus textarea on mount
	useEffect( () => {
		const timer = setTimeout( () => {
			textareaWrapperRef.current?.querySelector( 'textarea' )?.focus();
		}, 100 );
		return () => clearTimeout( timer );
	}, [] );

	// Handle copy
	const handleCopy = useCallback( () => {
		const output = formatOutput( sourceInfo, intent );
		onCopy( output );
	}, [ sourceInfo, intent, onCopy ] );

	// Handle keyboard shortcuts
	const handleKeyDown = useCallback( ( event ) => {
		// Cmd/Ctrl + Enter to submit
		if ( event.key === 'Enter' && ( event.metaKey || event.ctrlKey ) ) {
			event.preventDefault();
			handleCopy();
		}
		// Escape to close (stop propagation so document-level handler doesn't deactivate the tool)
		if ( event.key === 'Escape' ) {
			event.stopPropagation();
			onClose();
		}
	}, [ handleCopy, onClose ] );

	// Extract display values
	const { debugSource, blockInfo, label } = sourceInfo;
	const fileName = debugSource?.fileName;
	const lineNumber = debugSource?.lineNumber;
	const componentName = debugSource?.componentName;
	const blockName = blockInfo?.blockName;

	return (
		<div
			data-wp-block-grab="popover"
			style={ {
				...popoverStyles,
				top: Math.max( 8, Math.min( position.top, window.innerHeight - 400 ) ),
				left: Math.max( 8, Math.min( position.left, window.innerWidth - 470 ) )
			} }
			onKeyDown={ handleKeyDown }
		>
			{ /* Header */ }
			<div style={ headerStyles }>
				<h3 style={ titleStyles }>Grab Source</h3>
				<Button
					icon="no-alt"
					label="Close"
					onClick={ onClose }
					isSmall
				/>
			</div>

			{ /* Source Location */ }
			{ fileName && (
				<div style={ sectionStyles }>
					<div style={ labelStyles }>Location</div>
					<div style={ valueStyles }>
						{ fileName }:{ lineNumber }
						{ componentName && ` (${ componentName })` }
					</div>
				</div>
			) }

			{ /* Block Context */ }
			{ blockName && (
				<div style={ sectionStyles }>
					<div style={ labelStyles }>Block</div>
					<div style={ valueStyles }>{ blockName }</div>
				</div>
			) }

			{ /* No source found */ }
			{ ! fileName && ! blockName && (
				<div style={ sectionStyles }>
					<div style={ labelStyles }>Element</div>
					<div style={ valueStyles }>{ label }</div>
					<div style={ { fontSize: '11px', color: '#999', marginTop: '4px' } }>
						Source location not available. Build with wp-block-grab start.
					</div>
				</div>
			) }

			{ /* Intent Input */ }
			<div style={ sectionStyles }>
				<div style={ labelStyles }>What do you want to change?</div>
				<div ref={ textareaWrapperRef }>
					<TextareaControl
						value={ intent }
						onChange={ setIntent }
						placeholder="e.g., Change the label to 'Save'"
						rows={ 2 }
						__nextHasNoMarginBottom
					/>
				</div>
			</div>

			{ /* Buttons */ }
			<div style={ buttonRowStyles }>
				<Button variant="secondary" onClick={ onClose }>
					Cancel
				</Button>
				<Button variant="primary" onClick={ handleCopy }>
					Copy for AI
				</Button>
			</div>
		</div>
	);
};
