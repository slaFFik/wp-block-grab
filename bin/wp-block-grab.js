#!/usr/bin/env node

/**
 * wp-block-grab CLI
 *
 * Wraps @wordpress/scripts to inject source location tracking for AI coding agents.
 *
 * Commands:
 *   start - Development mode with source tracking enabled
 *   build - Production build (clean, passes through to wp-scripts)
 *
 * Usage: wp-block-grab start|build [options]
 */

const { spawn } = require( 'child_process' );
const path = require( 'path' );

const args = process.argv.slice( 2 );
const command = args[ 0 ];

/**
 * Show help message
 */
function showHelp() {
	console.log( `
wp-block-grab - AI-ready context extraction for WordPress Block Editor

Usage:
  wp-block-grab start [options]    Dev mode with source tracking enabled
  wp-block-grab build [options]    Production build (no source tracking)

All options are passed through to @wordpress/scripts.

Examples:
  wp-block-grab start --webpack-src-dir=block/src --output-path=block/build
  wp-block-grab build --webpack-src-dir=block/src --output-path=block/build

How it works:
  - 'start' injects source location tracking into your block code
  - Use Cmd+Shift+S (Mac) or Ctrl+Shift+S (Windows/Linux) to activate
  - Click any element to get source file, line number, and block context
  - Copy the formatted output to paste into AI coding agents

Learn more: https://github.com/slaFFik/wp-block-grab
` );
}

// Validate command
if ( ! command || ! [ 'build', 'start' ].includes( command ) ) {
	showHelp();
	process.exit( command ? 1 : 0 );
}

/**
 * Find wp-scripts binary in node_modules
 */
function findWpScripts() {
	try {
		return require.resolve( '@wordpress/scripts/bin/wp-scripts.js', {
			paths: [ process.cwd() ]
		} );
	} catch ( e ) {
		try {
			return require.resolve( '@wordpress/scripts/bin/wp-scripts.js' );
		} catch ( e2 ) {
			console.error( 'Error: @wordpress/scripts not found. Please install it:' );
			console.error( '  npm install --save-dev @wordpress/scripts' );
			process.exit( 1 );
		}
	}
}

const wpScriptsBin = findWpScripts();

// Conventional exit codes for signal-killed processes: 128 + signal number
const SIGNAL_CODES = { SIGHUP: 1, SIGINT: 2, SIGQUIT: 3, SIGTERM: 15 };

/**
 * Attach exit handlers to a child process so the parent mirrors its exit code.
 */
function forwardChildExit( child ) {
	child.on( 'error', ( err ) => {
		console.error( 'wp-block-grab: Failed to start wp-scripts:', err.message );
		process.exit( 1 );
	} );

	child.on( 'exit', ( code, signal ) => {
		if ( signal ) {
			process.exit( 128 + ( SIGNAL_CODES[ signal ] || 1 ) );
		}
		process.exit( code ?? 0 );
	} );
}

/**
 * Run production build (pass through to wp-scripts)
 */
function runProductionBuild() {
	const child = spawn( process.execPath, [ wpScriptsBin, ...args ], {
		stdio: 'inherit',
		env: process.env
	} );

	forwardChildExit( child );
}

/**
 * Run development build with source tracking
 */
function runDevBuild() {
	// Paths to configs and plugins inside the wp-block-grab package
	const packageRoot = path.resolve( __dirname, '..' );
	const babelPluginPath = path.join( packageRoot, 'babel', 'plugin-jsx-source.js' );
	const runtimeEntryPath = path.join( packageRoot, 'runtime', 'index.js' );
	const webpackConfigPath = path.join( packageRoot, 'config', 'webpack.config.cjs' );
	// Build arguments
	const wpScriptsArgs = [
		command,
		'--config', webpackConfigPath,
		...args.slice( 1 )
	];

	console.log( '\n\x1b[36m%s\x1b[0m\n', '🎯 wp-block-grab: Source tracking enabled (Cmd+Shift+S to activate)' );

	// Spawn wp-scripts with environment variables for dynamic paths
	const child = spawn( process.execPath, [ wpScriptsBin, ...wpScriptsArgs ], {
		stdio: 'inherit',
		env: {
			...process.env,
			// Pass paths to config files via env vars
			WP_BLOCK_GRAB_RUNTIME: runtimeEntryPath,
			WP_BLOCK_GRAB_BABEL_PLUGIN: babelPluginPath
		}
	} );

	forwardChildExit( child );
}

// Run the appropriate command
if ( command === 'build' ) {
	runProductionBuild();
} else {
	runDevBuild();
}
