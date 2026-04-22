/**
 * @jest-environment node
 */

const {
	isFrontendEntry,
	injectRuntime,
	addBabelPluginToLoader,
	findAndPatchBabelLoader,
	patchExcludeForRuntime,
} = require( './webpack-utils.cjs' );

// ── isFrontendEntry ────────────────────────────────────────────────

describe( 'isFrontendEntry', () => {
	it.each( [
		[ 'view', true ],
		[ 'view-script', true ],
		[ 'render', true ],
		[ 'frontend', true ],
		[ 'script', true ],
		[ 'script.js', true ],
		[ 'view.js', true ],
	] )( 'should match frontend entry "%s"', ( key, expected ) => {
		expect( isFrontendEntry( key ) ).toBe( expected );
	} );

	it.each( [
		[ 'index', false ],
		[ 'editor', false ],
		[ 'viewport', false ],
		[ 'scripting', false ],
		[ 'review', false ],
	] )( 'should reject non-frontend entry "%s"', ( key, expected ) => {
		expect( isFrontendEntry( key ) ).toBe( expected );
	} );

	it( 'should match nested path by checking last segment', () => {
		expect( isFrontendEntry( 'blocks/view' ) ).toBe( true );
		expect( isFrontendEntry( 'blocks/view-script' ) ).toBe( true );
		expect( isFrontendEntry( 'blocks/index' ) ).toBe( false );
	} );
} );

// ── injectRuntime ──────────────────────────────────────────────────

describe( 'injectRuntime', () => {
	const runtime = '/path/to/runtime.js';

	it( 'should convert string entry to import array', () => {
		const entries = { index: './src/index.js' };
		injectRuntime( entries, runtime );
		expect( entries.index ).toEqual( {
			import: [ runtime, './src/index.js' ],
		} );
	} );

	it( 'should prepend to array entry', () => {
		const entries = { index: [ './src/a.js', './src/b.js' ] };
		injectRuntime( entries, runtime );
		expect( entries.index ).toEqual( {
			import: [ runtime, './src/a.js', './src/b.js' ],
		} );
	} );

	it( 'should prepend to object entry with import array', () => {
		const entries = { index: { import: [ './src/index.js' ] } };
		injectRuntime( entries, runtime );
		expect( entries.index.import ).toEqual( [ runtime, './src/index.js' ] );
	} );

	it( 'should prepend to object entry with import string', () => {
		const entries = { index: { import: './src/index.js' } };
		injectRuntime( entries, runtime );
		expect( entries.index.import ).toEqual( [ runtime, './src/index.js' ] );
	} );

	it( 'should skip frontend entries', () => {
		const entries = {
			index: './src/index.js',
			view: './src/view.js',
			'view-script': './src/view-script.js',
		};
		injectRuntime( entries, runtime );
		expect( entries.index.import ).toContain( runtime );
		expect( entries.view ).toBe( './src/view.js' );
		expect( entries[ 'view-script' ] ).toBe( './src/view-script.js' );
	} );
} );

// ── addBabelPluginToLoader ─────────────────────────────────────────

describe( 'addBabelPluginToLoader', () => {
	const pluginPath = '/path/to/plugin.js';

	it( 'should patch string babel-loader', () => {
		const loaders = [ '/node_modules/babel-loader/lib/index.js' ];
		const result = addBabelPluginToLoader( loaders, pluginPath );
		expect( result ).toBe( true );
		expect( loaders[ 0 ] ).toEqual( {
			loader: '/node_modules/babel-loader/lib/index.js',
			options: { plugins: [ pluginPath ] },
		} );
	} );

	it( 'should patch object babel-loader', () => {
		const loaders = [ { loader: 'babel-loader', options: { plugins: [] } } ];
		const result = addBabelPluginToLoader( loaders, pluginPath );
		expect( result ).toBe( true );
		expect( loaders[ 0 ].options.plugins ).toContain( pluginPath );
	} );

	it( 'should create options and plugins when missing', () => {
		const loaders = [ { loader: 'babel-loader' } ];
		addBabelPluginToLoader( loaders, pluginPath );
		expect( loaders[ 0 ].options.plugins ).toEqual( [ pluginPath ] );
	} );

	it( 'should return false when no babel-loader found', () => {
		const loaders = [ { loader: 'css-loader' } ];
		expect( addBabelPluginToLoader( loaders, pluginPath ) ).toBe( false );
	} );
} );

// ── findAndPatchBabelLoader ────────────────────────────────────────

describe( 'findAndPatchBabelLoader', () => {
	const pluginPath = '/path/to/plugin.js';

	it( 'should patch rule.use array containing babel-loader', () => {
		const rules = [
			{ use: [ { loader: 'babel-loader', options: {} } ] },
		];
		expect( findAndPatchBabelLoader( rules, pluginPath ) ).toBe( true );
		expect( rules[ 0 ].use[ 0 ].options.plugins ).toContain( pluginPath );
	} );

	it( 'should patch rule.loader string', () => {
		const rules = [ { loader: 'babel-loader' } ];
		expect( findAndPatchBabelLoader( rules, pluginPath ) ).toBe( true );
		expect( rules[ 0 ].options.plugins ).toContain( pluginPath );
	} );

	it( 'should recurse into oneOf', () => {
		const rules = [
			{
				oneOf: [
					{ use: [ { loader: 'babel-loader' } ] },
				],
			},
		];
		expect( findAndPatchBabelLoader( rules, pluginPath ) ).toBe( true );
		expect( rules[ 0 ].oneOf[ 0 ].use[ 0 ].options.plugins ).toContain( pluginPath );
	} );

	it( 'should recurse into nested rules', () => {
		const rules = [
			{
				rules: [
					{ use: [ { loader: 'babel-loader' } ] },
				],
			},
		];
		expect( findAndPatchBabelLoader( rules, pluginPath ) ).toBe( true );
		expect( rules[ 0 ].rules[ 0 ].use[ 0 ].options.plugins ).toContain( pluginPath );
	} );

	it( 'should return false when no babel-loader anywhere', () => {
		const rules = [
			{ use: [ { loader: 'css-loader' } ] },
			{ oneOf: [ { loader: 'file-loader' } ] },
		];
		expect( findAndPatchBabelLoader( rules, pluginPath ) ).toBe( false );
	} );
} );

// ── patchExcludeForRuntime ────────────────────────────────────────

describe( 'patchExcludeForRuntime', () => {
	const runtimeDir = '/abs/path/to/wp-block-grab/runtime';

	it( 'should patch exclude on babel-loader rule with /node_modules/ exclude', () => {
		const rules = [
			{
				exclude: /node_modules/,
				use: [ { loader: 'babel-loader', options: {} } ],
			},
		];
		expect( patchExcludeForRuntime( rules, runtimeDir ) ).toBe( true );
		expect( rules[ 0 ].exclude ).toEqual( {
			and: [ /node_modules/ ],
			not: [ runtimeDir ],
		} );
	} );

	it( 'should not patch rules without babel-loader', () => {
		const rules = [
			{
				exclude: /node_modules/,
				use: [ { loader: 'css-loader' } ],
			},
		];
		expect( patchExcludeForRuntime( rules, runtimeDir ) ).toBe( false );
		expect( rules[ 0 ].exclude ).toEqual( /node_modules/ );
	} );

	it( 'should not patch babel-loader rules without /node_modules/ exclude', () => {
		const rules = [
			{
				exclude: /\.test\.js$/,
				use: [ { loader: 'babel-loader' } ],
			},
		];
		expect( patchExcludeForRuntime( rules, runtimeDir ) ).toBe( false );
		expect( rules[ 0 ].exclude ).toEqual( /\.test\.js$/ );
	} );

	it( 'should not patch babel-loader rules with no exclude', () => {
		const rules = [
			{
				use: [ { loader: 'babel-loader' } ],
			},
		];
		expect( patchExcludeForRuntime( rules, runtimeDir ) ).toBe( false );
	} );

	it( 'should recurse into oneOf', () => {
		const rules = [
			{
				oneOf: [
					{
						exclude: /node_modules/,
						use: [ { loader: 'babel-loader' } ],
					},
				],
			},
		];
		expect( patchExcludeForRuntime( rules, runtimeDir ) ).toBe( true );
		expect( rules[ 0 ].oneOf[ 0 ].exclude ).toEqual( {
			and: [ /node_modules/ ],
			not: [ runtimeDir ],
		} );
	} );

	it( 'should recurse into nested rules', () => {
		const rules = [
			{
				rules: [
					{
						exclude: /node_modules/,
						use: [ { loader: 'babel-loader' } ],
					},
				],
			},
		];
		expect( patchExcludeForRuntime( rules, runtimeDir ) ).toBe( true );
		expect( rules[ 0 ].rules[ 0 ].exclude ).toEqual( {
			and: [ /node_modules/ ],
			not: [ runtimeDir ],
		} );
	} );

	it( 'should handle rule.loader string form', () => {
		const rules = [
			{
				exclude: /node_modules/,
				loader: 'babel-loader',
			},
		];
		expect( patchExcludeForRuntime( rules, runtimeDir ) ).toBe( true );
		expect( rules[ 0 ].exclude ).toEqual( {
			and: [ /node_modules/ ],
			not: [ runtimeDir ],
		} );
	} );
} );
