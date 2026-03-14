import {
	parseSourceString,
	getComponentName,
	getFiberFromElement,
	getSourceFromElement,
} from './source-extractor';

// ── parseSourceString ──────────────────────────────────────────────

describe( 'parseSourceString', () => {
	it( 'should parse standard path:line:column', () => {
		expect( parseSourceString( 'plugins/my-plugin/src/index.js:10:5' ) ).toEqual( {
			fileName: 'plugins/my-plugin/src/index.js',
			lineNumber: 10,
			columnNumber: 5,
		} );
	} );

	it( 'should handle Windows-style paths with drive letter colons', () => {
		expect( parseSourceString( 'C:/Users/dev/project/src/index.js:42:8' ) ).toEqual( {
			fileName: 'C:/Users/dev/project/src/index.js',
			lineNumber: 42,
			columnNumber: 8,
		} );
	} );

	it( 'should default column to 1 when only line is provided', () => {
		expect( parseSourceString( 'src/index.js:10' ) ).toEqual( {
			fileName: 'src/index.js',
			lineNumber: 10,
			columnNumber: 1,
		} );
	} );

	it( 'should return null for null input', () => {
		expect( parseSourceString( null ) ).toBeNull();
	} );

	it( 'should return null for empty string', () => {
		expect( parseSourceString( '' ) ).toBeNull();
	} );

	it( 'should return null for string without colons', () => {
		expect( parseSourceString( 'no-colons-here' ) ).toBeNull();
	} );

	it( 'should return null when line is not a number', () => {
		expect( parseSourceString( 'file.js:abc' ) ).toBeNull();
	} );
} );

// ── getComponentName ───────────────────────────────────────────────

describe( 'getComponentName', () => {
	it( 'should return null for null fiber', () => {
		expect( getComponentName( null ) ).toBeNull();
	} );

	it( 'should return null for fiber without type', () => {
		expect( getComponentName( {} ) ).toBeNull();
		expect( getComponentName( { type: null } ) ).toBeNull();
	} );

	it( 'should return displayName from function component', () => {
		const fn = function MyComp() {};
		fn.displayName = 'CustomName';
		expect( getComponentName( { type: fn } ) ).toBe( 'CustomName' );
	} );

	it( 'should fall back to function name', () => {
		function MyComponent() {}
		expect( getComponentName( { type: MyComponent } ) ).toBe( 'MyComponent' );
	} );

	it( 'should return null for anonymous function', () => {
		// Assign to variable first to avoid ES6 name inference from property key
		const anon = ( () => () => {} )();
		expect( getComponentName( { type: anon } ) ).toBeNull();
	} );

	it( 'should handle React.memo(fn) — prefer memo displayName', () => {
		function Inner() {}
		const fiber = {
			type: {
				$$typeof: Symbol.for( 'react.memo' ),
				displayName: 'MemoName',
				type: Inner,
			},
		};
		expect( getComponentName( fiber ) ).toBe( 'MemoName' );
	} );

	it( 'should handle React.memo(fn) — fall back to inner displayName', () => {
		const inner = function() {};
		inner.displayName = 'InnerDisplay';
		const fiber = {
			type: {
				$$typeof: Symbol.for( 'react.memo' ),
				type: inner,
			},
		};
		expect( getComponentName( fiber ) ).toBe( 'InnerDisplay' );
	} );

	it( 'should handle React.memo(fn) — fall back to inner name', () => {
		function ActualName() {}
		const fiber = {
			type: {
				$$typeof: Symbol.for( 'react.memo' ),
				type: ActualName,
			},
		};
		expect( getComponentName( fiber ) ).toBe( 'ActualName' );
	} );

	it( 'should handle forwardRef — prefer outer displayName', () => {
		const fiber = {
			type: {
				displayName: 'ForwardedName',
				render: function InnerRender() {},
			},
		};
		expect( getComponentName( fiber ) ).toBe( 'ForwardedName' );
	} );

	it( 'should handle forwardRef — fall back to render displayName', () => {
		const render = function() {};
		render.displayName = 'RenderDisplay';
		const fiber = {
			type: {
				render,
			},
		};
		expect( getComponentName( fiber ) ).toBe( 'RenderDisplay' );
	} );

	it( 'should handle forwardRef — clean Unforwarded prefix (regression)', () => {
		const fiber = {
			type: {
				render: function UnforwardedPanelBody() {},
			},
		};
		expect( getComponentName( fiber ) ).toBe( 'PanelBody' );
	} );

	it( 'should strip Unforwarded prefix from TextControl (regression)', () => {
		const fiber = {
			type: {
				render: function UnforwardedTextControl() {},
			},
		};
		expect( getComponentName( fiber ) ).toBe( 'TextControl' );
	} );

	it( 'should handle memo(forwardRef(fn)) — prefer memo displayName', () => {
		const fiber = {
			type: {
				$$typeof: Symbol.for( 'react.memo' ),
				displayName: 'MemoForwardName',
				type: {
					render: function UnforwardedInner() {},
				},
			},
		};
		expect( getComponentName( fiber ) ).toBe( 'MemoForwardName' );
	} );

	it( 'should handle memo(forwardRef(fn)) — fall back to inner displayName', () => {
		const inner = {
			displayName: 'ForwardRefDisplay',
			render: function UnforwardedInner() {},
		};
		const fiber = {
			type: {
				$$typeof: Symbol.for( 'react.memo' ),
				type: inner,
			},
		};
		expect( getComponentName( fiber ) ).toBe( 'ForwardRefDisplay' );
	} );

	it( 'should handle memo(forwardRef(fn)) — clean render name as last resort', () => {
		const fiber = {
			type: {
				$$typeof: Symbol.for( 'react.memo' ),
				type: {
					render: function UnforwardedDropdown() {},
				},
			},
		};
		expect( getComponentName( fiber ) ).toBe( 'Dropdown' );
	} );
} );

// ── getFiberFromElement ────────────────────────────────────────────

describe( 'getFiberFromElement', () => {
	it( 'should find __reactFiber$ key', () => {
		const fiberObj = { tag: 5 };
		const el = { '__reactFiber$abc123': fiberObj };
		expect( getFiberFromElement( el ) ).toBe( fiberObj );
	} );

	it( 'should find __reactInternalInstance$ key', () => {
		const fiberObj = { tag: 3 };
		const el = { '__reactInternalInstance$xyz': fiberObj };
		expect( getFiberFromElement( el ) ).toBe( fiberObj );
	} );

	it( 'should return null when no React key exists', () => {
		expect( getFiberFromElement( { className: 'foo' } ) ).toBeNull();
	} );
} );

// ── getSourceFromElement ───────────────────────────────────────────

describe( 'getSourceFromElement', () => {
	it( 'should prefer component source over DOM source', () => {
		const el = document.createElement( 'div' );
		el.setAttribute( 'data-wp-source', 'plugins/p/src/a.js:1:1' );

		// Attach a fiber with component source
		const fiber = {
			type: function Button() {},
			memoizedProps: {
				'data-wp-component-source': 'plugins/p/src/button.js:5:3',
			},
			return: null,
		};
		el[ '__reactFiber$test' ] = fiber;

		const result = getSourceFromElement( el );
		expect( result.fileName ).toBe( 'plugins/p/src/button.js' );
		expect( result.lineNumber ).toBe( 5 );
		expect( result.columnNumber ).toBe( 3 );
		expect( result.componentName ).toBe( 'Button' );
	} );

	it( 'should fall back to DOM data-wp-source walk', () => {
		const parent = document.createElement( 'div' );
		parent.setAttribute( 'data-wp-source', 'plugins/p/src/parent.js:10:1' );
		const child = document.createElement( 'span' );
		parent.appendChild( child );
		document.body.appendChild( parent );

		const result = getSourceFromElement( child );
		expect( result.fileName ).toBe( 'plugins/p/src/parent.js' );
		expect( result.lineNumber ).toBe( 10 );
		expect( result.clickedTag ).toBe( 'span' );

		document.body.removeChild( parent );
	} );

	it( 'should return minimal { clickedTag } when nothing found', () => {
		const el = document.createElement( 'p' );
		document.body.appendChild( el );

		const result = getSourceFromElement( el );
		expect( result.clickedTag ).toBe( 'p' );
		expect( result.fileName ).toBeUndefined();

		document.body.removeChild( el );
	} );
} );
