module.exports = {
	testEnvironment: 'jsdom',
	testMatch: [
		'<rootDir>/**/*.test.js',
	],
	transform: {
		'\\.js$': 'babel-jest',
	},
	transformIgnorePatterns: [
		'/node_modules/',
	],
};
