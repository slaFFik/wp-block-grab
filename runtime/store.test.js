import { createStore } from './store';

describe( 'createStore', () => {
	let store;

	beforeEach( () => {
		store = createStore();
	} );

	it( 'should have initial state { isActive: false }', () => {
		expect( store.getState() ).toEqual( { isActive: false } );
	} );

	it( 'should merge state with setState', () => {
		store.setState( { isActive: true } );
		expect( store.getState() ).toEqual( { isActive: true } );
	} );

	it( 'should merge without replacing unrelated keys', () => {
		store.setState( { foo: 'bar' } );
		store.setState( { isActive: true } );
		expect( store.getState() ).toEqual( { isActive: true, foo: 'bar' } );
	} );

	it( 'should notify subscribers on state change', () => {
		const listener = jest.fn();
		store.subscribe( listener );
		store.setState( { isActive: true } );
		expect( listener ).toHaveBeenCalledWith( { isActive: true } );
	} );

	it( 'should stop notifying after unsubscribe', () => {
		const listener = jest.fn();
		const unsubscribe = store.subscribe( listener );
		unsubscribe();
		store.setState( { isActive: true } );
		expect( listener ).not.toHaveBeenCalled();
	} );

	it( 'should notify multiple listeners', () => {
		const listener1 = jest.fn();
		const listener2 = jest.fn();
		store.subscribe( listener1 );
		store.subscribe( listener2 );
		store.setState( { isActive: true } );
		expect( listener1 ).toHaveBeenCalledTimes( 1 );
		expect( listener2 ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'should not duplicate a listener subscribed twice', () => {
		const listener = jest.fn();
		store.subscribe( listener );
		store.subscribe( listener );
		store.setState( { isActive: true } );
		// Set uses identity, so same fn added twice is stored once
		expect( listener ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'should pass new state to each listener call', () => {
		const states = [];
		store.subscribe( ( s ) => states.push( { ...s } ) );
		store.setState( { isActive: true } );
		store.setState( { isActive: false } );
		expect( states ).toEqual( [
			{ isActive: true },
			{ isActive: false },
		] );
	} );
} );
