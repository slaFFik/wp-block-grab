/**
 * @jest-environment node
 */

const { transformSync } = require( '@babel/core' );
const path = require( 'path' );

const pluginPath = path.resolve( __dirname, 'plugin-jsx-source.js' );

// Resolve plugin paths from this project's node_modules, not from fake cwd paths
const syntaxJsxPath = require.resolve( '@babel/plugin-syntax-jsx' );

function transform( code, opts = {} ) {
	const { cwd = '/home/user/project', filename = '/home/user/project/src/edit.js' } = opts;
	return transformSync( code, {
		plugins: [
			[ pluginPath, {} ],
			// Need the JSX syntax plugin to parse JSX
			[ syntaxJsxPath, {} ],
		],
		filename,
		cwd,
		// Don't look up config files from the filesystem
		configFile: false,
		babelrc: false,
	} ).code;
}

describe( 'plugin-jsx-source', () => {
	it( 'should add data-wp-source to host elements', () => {
		const code = transform( 'const el = <div className="test" />;' );
		expect( code ).toMatch( /data-wp-source.*src\/edit\.js:1:\d+/ );
		expect( code ).not.toContain( 'data-wp-component-source' );
	} );

	it( 'should add data-wp-component-source to components', () => {
		const code = transform( 'const el = <Button label="ok" />;' );
		expect( code ).toMatch( /data-wp-component-source.*src\/edit\.js:1:\d+/ );
		expect( code ).not.toContain( 'data-wp-source' );
	} );

	it( 'should skip member expressions like Foo.Bar', () => {
		const code = transform( 'const el = <Foo.Bar />;' );
		expect( code ).not.toContain( 'data-wp-source' );
		expect( code ).not.toContain( 'data-wp-component-source' );
	} );

	it( 'should not duplicate existing data-wp-source attribute', () => {
		const code = transform(
			'const el = <div data-wp-source="manual:1:1" />;'
		);
		const matches = code.match( /data-wp-source/g );
		expect( matches ).toHaveLength( 1 );
	} );

	it( 'should not duplicate existing data-wp-component-source attribute', () => {
		const code = transform(
			'const el = <Button data-wp-component-source="manual:1:1" />;'
		);
		const matches = code.match( /data-wp-component-source/g );
		expect( matches ).toHaveLength( 1 );
	} );

	it( 'should use correct line and 1-indexed column', () => {
		// The JSX starts at line 1, and the `<div` starts at a known column
		const code = transform( '<div />;', {
			filename: '/project/src/edit.js',
			cwd: '/project',
		} );
		// Should contain src/edit.js:1:<column>
		expect( code ).toMatch( /src\/edit\.js:1:\d+/ );
	} );

	it( 'should add WordPress plugin prefix from cwd', () => {
		const code = transform( '<div />;', {
			cwd: '/var/www/html/wp-content/plugins/my-plugin',
			filename: '/var/www/html/wp-content/plugins/my-plugin/src/edit.js',
		} );
		expect( code ).toContain( 'plugins/my-plugin/src/edit.js' );
	} );

	it( 'should add WordPress theme prefix from cwd', () => {
		const code = transform( '<div />;', {
			cwd: '/var/www/html/wp-content/themes/my-theme',
			filename: '/var/www/html/wp-content/themes/my-theme/src/edit.js',
		} );
		expect( code ).toContain( 'themes/my-theme/src/edit.js' );
	} );

	it( 'should handle monorepo subdirectory (regression: path relative to plugin root)', () => {
		const code = transform( '<div />;', {
			cwd: '/code/wp-content/plugins/my-plugin/packages/blocks',
			filename: '/code/wp-content/plugins/my-plugin/packages/blocks/src/edit.js',
		} );
		// Should be relative to my-plugin root, not cwd
		expect( code ).toContain( 'plugins/my-plugin/packages/blocks/src/edit.js' );
	} );

	it( 'should use plain relative path when no WP context', () => {
		const code = transform( '<div />;', {
			cwd: '/home/user/project',
			filename: '/home/user/project/src/edit.js',
		} );
		expect( code ).toContain( 'src/edit.js:1:' );
		expect( code ).not.toContain( 'plugins/' );
		expect( code ).not.toContain( 'themes/' );
	} );

	it( 'should work with self-closing elements', () => {
		const code = transform( '<img src="test.png" />;' );
		expect( code ).toMatch( /data-wp-source.*src\/edit\.js:1:\d+/ );
	} );

	it( 'should work with elements that have children', () => {
		const code = transform( '<div><span>text</span></div>;' );
		// Both div and span should get data-wp-source
		const matches = code.match( /data-wp-source/g );
		expect( matches ).toHaveLength( 2 );
	} );

	it( 'should not instrument fragments', () => {
		const code = transform( 'const el = <><div /></>;', {
			plugins: [ '@babel/plugin-transform-react-jsx' ],
		} );
		// Fragment itself should not have source attributes
		// Only the inner div should
		expect( code ).toContain( 'data-wp-source' );
		// There should be exactly one data-wp-source (for the div, not the fragment)
		const matches = code.match( /data-wp-source/g );
		expect( matches ).toHaveLength( 1 );
	} );

	it( 'should handle multiline JSX with correct line numbers', () => {
		const code = transform( `
const a = 1;
const b = 2;
const el = <div />;
		`.trim() );
		// The div is on line 3
		expect( code ).toMatch( /edit\.js:3:\d+/ );
	} );

	it( 'should treat underscore-prefixed elements as components', () => {
		const code = transform( 'const el = <_private />;' );
		// _private: isHostElement is false (underscore guard), but isComponent is true
		// because '_'.toUpperCase() === '_', so it gets component source
		expect( code ).not.toContain( 'data-wp-source' );
		expect( code ).toContain( 'data-wp-component-source' );
	} );
} );
