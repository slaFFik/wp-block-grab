import { formatOutput } from './output-formatter';

describe( 'formatOutput', () => {
	it( 'should include all fields in correct order', () => {
		const el = document.createElement( 'button' );
		el.className = 'components-button is-primary';

		const result = formatOutput(
			{
				debugSource: {
					fileName: 'plugins/my-plugin/src/edit.js',
					lineNumber: 42,
					componentName: 'Button',
					componentPath: [ 'Button', 'Toolbar', 'Edit' ],
				},
				blockInfo: {
					blockName: 'core/paragraph',
					controlContext: {
						panelTitle: 'Typography',
						labelText: 'Font size',
						controlType: 'select',
						currentValue: '16px',
					},
				},
				element: el,
			},
			'Change the font size'
		);

		const lines = result.split( '\n' );
		expect( lines[ 0 ] ).toBe( '<source_context>' );
		expect( lines[ 1 ] ).toBe( 'Intent: Change the font size' );
		expect( lines[ 2 ] ).toBe( 'Location: plugins/my-plugin/src/edit.js:42 (<Button>)' );
		expect( lines[ 3 ] ).toBe( 'Component path: Edit > Toolbar > Button' );
		expect( lines[ 4 ] ).toBe( 'Block: core/paragraph' );
		expect( lines[ 5 ] ).toBe( 'Panel: Typography' );
		expect( lines[ 6 ] ).toBe( 'Control: Font size (select, current: 16px)' );
		expect( lines[ 7 ] ).toBe( 'Clicked: button.components-button.is-primary' );
		expect( lines[ 8 ] ).toBe( '</source_context>' );
	} );

	it( 'should normalize multiline intent to single line', () => {
		const result = formatOutput(
			{
				debugSource: { fileName: 'src/a.js', lineNumber: 1 },
				blockInfo: {},
				element: null,
			},
			'Line one\n  Line two\n\nLine three'
		);
		expect( result ).toContain( 'Intent: Line one Line two Line three' );
	} );

	it( 'should omit intent when empty', () => {
		const result = formatOutput(
			{
				debugSource: { fileName: 'src/a.js', lineNumber: 1 },
				blockInfo: {},
				element: null,
			},
			''
		);
		expect( result ).not.toContain( 'Intent:' );
	} );

	it( 'should show location without component name', () => {
		const result = formatOutput(
			{
				debugSource: { fileName: 'src/edit.js', lineNumber: 10 },
				blockInfo: {},
				element: null,
			},
			''
		);
		expect( result ).toContain( 'Location: src/edit.js:10' );
		expect( result ).not.toContain( '(<' );
	} );

	it( 'should show location with component name', () => {
		const result = formatOutput(
			{
				debugSource: {
					fileName: 'src/edit.js',
					lineNumber: 10,
					componentName: 'MyBlock',
				},
				blockInfo: {},
				element: null,
			},
			''
		);
		expect( result ).toContain( 'Location: src/edit.js:10 (<MyBlock>)' );
	} );

	it( 'should omit component path when 1 or fewer items', () => {
		const result = formatOutput(
			{
				debugSource: {
					fileName: 'src/a.js',
					lineNumber: 1,
					componentPath: [ 'OnlyOne' ],
				},
				blockInfo: {},
				element: null,
			},
			''
		);
		expect( result ).not.toContain( 'Component path:' );
	} );

	it( 'should reverse component path for parent > child order', () => {
		const result = formatOutput(
			{
				debugSource: {
					fileName: 'src/a.js',
					lineNumber: 1,
					componentPath: [ 'Child', 'Middle', 'Parent' ],
				},
				blockInfo: {},
				element: null,
			},
			''
		);
		expect( result ).toContain( 'Component path: Parent > Middle > Child' );
	} );

	it( 'should cap component path at 5 items', () => {
		const result = formatOutput(
			{
				debugSource: {
					fileName: 'src/a.js',
					lineNumber: 1,
					componentPath: [ 'A', 'B', 'C', 'D', 'E', 'F', 'G' ],
				},
				blockInfo: {},
				element: null,
			},
			''
		);
		// Slices first 5 then reverses
		expect( result ).toContain( 'Component path: E > D > C > B > A' );
	} );

	it( 'should show panel title', () => {
		const result = formatOutput(
			{
				debugSource: { fileName: 'src/a.js', lineNumber: 1 },
				blockInfo: {
					blockName: 'core/button',
					controlContext: { panelTitle: 'Color' },
				},
				element: null,
			},
			''
		);
		expect( result ).toContain( 'Panel: Color' );
	} );

	it( 'should show control label with type and value', () => {
		const result = formatOutput(
			{
				debugSource: { fileName: 'src/a.js', lineNumber: 1 },
				blockInfo: {
					blockName: 'core/button',
					controlContext: {
						labelText: 'Width',
						controlType: 'range',
						currentValue: '50',
					},
				},
				element: null,
			},
			''
		);
		expect( result ).toContain( 'Control: Width (range, current: 50)' );
	} );

	it( 'should show control label without value when empty', () => {
		const result = formatOutput(
			{
				debugSource: { fileName: 'src/a.js', lineNumber: 1 },
				blockInfo: {
					blockName: 'core/button',
					controlContext: {
						labelText: 'Align',
						controlType: 'select',
						currentValue: '',
					},
				},
				element: null,
			},
			''
		);
		expect( result ).toContain( 'Control: Align (select)' );
	} );

	it( 'should truncate classes at 5 with (+N) suffix', () => {
		const el = document.createElement( 'div' );
		el.className = 'a b c d e f g';

		const result = formatOutput(
			{
				debugSource: { fileName: 'src/a.js', lineNumber: 1 },
				blockInfo: {},
				element: el,
			},
			''
		);
		expect( result ).toContain( 'Clicked: div.a.b.c.d.e (+2)' );
	} );

	it( 'should show tag only when element has no classes', () => {
		const el = document.createElement( 'span' );

		const result = formatOutput(
			{
				debugSource: { fileName: 'src/a.js', lineNumber: 1 },
				blockInfo: {},
				element: el,
			},
			''
		);
		expect( result ).toContain( 'Clicked: span' );
	} );

	it( 'should show fallback note when no source and no block', () => {
		const result = formatOutput(
			{
				debugSource: {},
				blockInfo: {},
				element: null,
			},
			''
		);
		expect( result ).toContain( 'Note: Source location not available.' );
	} );
} );
