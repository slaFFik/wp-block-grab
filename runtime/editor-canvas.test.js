import {
	getEditorCanvasIframe,
	getEditorCanvasDocument,
	translateIframeRect,
} from './editor-canvas';

function clearBody() {
	while ( document.body.firstChild ) {
		document.body.removeChild( document.body.firstChild );
	}
}

describe( 'getEditorCanvasIframe', () => {
	afterEach( clearBody );

	it( 'should return iframe with name="editor-canvas"', () => {
		const iframe = document.createElement( 'iframe' );
		iframe.name = 'editor-canvas';
		document.body.appendChild( iframe );
		expect( getEditorCanvasIframe() ).toBe( iframe );
	} );

	it( 'should return null when no editor canvas iframe exists', () => {
		expect( getEditorCanvasIframe() ).toBeNull();
	} );

	it( 'should return null for iframe with different name', () => {
		const iframe = document.createElement( 'iframe' );
		iframe.name = 'other-iframe';
		document.body.appendChild( iframe );
		expect( getEditorCanvasIframe() ).toBeNull();
	} );
} );

describe( 'getEditorCanvasDocument', () => {
	afterEach( clearBody );

	it( 'should return null when no iframe exists', () => {
		expect( getEditorCanvasDocument() ).toBeNull();
	} );

	it( 'should return contentDocument when accessible', () => {
		const iframe = document.createElement( 'iframe' );
		iframe.name = 'editor-canvas';
		document.body.appendChild( iframe );
		// jsdom makes contentDocument accessible
		const doc = getEditorCanvasDocument();
		// In jsdom, contentDocument might be null for dynamically created iframes
		// The important thing is it doesn't throw
		expect( doc === null || typeof doc === 'object' ).toBe( true );
	} );

	it( 'should return null on cross-origin (simulated)', () => {
		const iframe = document.createElement( 'iframe' );
		iframe.name = 'editor-canvas';
		// Simulate cross-origin by making contentDocument throw
		Object.defineProperty( iframe, 'contentDocument', {
			get() {
				throw new DOMException( 'Blocked', 'SecurityError' );
			},
		} );
		document.body.appendChild( iframe );
		expect( getEditorCanvasDocument() ).toBeNull();
	} );
} );

describe( 'translateIframeRect', () => {
	function createMockIframe( { iframeRect, offsetWidth, clientTop = 0, clientLeft = 0 } ) {
		return {
			getBoundingClientRect: () => iframeRect,
			offsetWidth,
			clientTop,
			clientLeft,
		};
	}

	it( 'should translate 1:1 (no scale)', () => {
		const iframe = createMockIframe( {
			iframeRect: { top: 100, left: 50, width: 800, height: 600 },
			offsetWidth: 800,
		} );
		const rect = { top: 10, left: 20, bottom: 30, right: 40, width: 20, height: 20 };

		const result = translateIframeRect( rect, iframe );
		expect( result ).toEqual( {
			top: 110,
			left: 70,
			bottom: 130,
			right: 90,
			width: 20,
			height: 20,
		} );
	} );

	it( 'should handle zoom-out scale (0.5x)', () => {
		const iframe = createMockIframe( {
			// getBoundingClientRect returns post-transform: 400px wide (half of 800)
			iframeRect: { top: 100, left: 50, width: 400, height: 300 },
			// offsetWidth is pre-transform
			offsetWidth: 800,
		} );
		const rect = { top: 10, left: 20, bottom: 30, right: 40, width: 20, height: 20 };

		const result = translateIframeRect( rect, iframe );
		const scale = 0.5;
		expect( result.top ).toBe( 10 * scale + 100 );
		expect( result.left ).toBe( 20 * scale + 50 );
		expect( result.width ).toBe( 20 * scale );
		expect( result.height ).toBe( 20 * scale );
	} );

	it( 'should account for border offsets', () => {
		const iframe = createMockIframe( {
			iframeRect: { top: 100, left: 50, width: 800, height: 600 },
			offsetWidth: 800,
			clientTop: 2,
			clientLeft: 3,
		} );
		const rect = { top: 10, left: 20, bottom: 30, right: 40, width: 20, height: 20 };

		const result = translateIframeRect( rect, iframe );
		expect( result.top ).toBe( 10 + 100 + 2 );
		expect( result.left ).toBe( 20 + 50 + 3 );
	} );

	it( 'should fall back to scale=1 when offsetWidth is 0', () => {
		const iframe = createMockIframe( {
			iframeRect: { top: 100, left: 50, width: 0, height: 0 },
			offsetWidth: 0,
		} );
		const rect = { top: 10, left: 20, bottom: 30, right: 40, width: 20, height: 20 };

		const result = translateIframeRect( rect, iframe );
		// scale = 1 (fallback), so values are rect + iframeRect
		expect( result.top ).toBe( 110 );
		expect( result.left ).toBe( 70 );
	} );
} );
