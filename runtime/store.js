/**
 * Simple State Store
 *
 * Lightweight state management for the source tracking UI.
 * Supports subscriptions for React component updates.
 */

/**
 * Create a simple state store with subscription support
 *
 * @return {Object} Store with getState, setState, and subscribe methods
 */
export function createStore() {
	let state = {
		isActive: false
	};

	const listeners = new Set();

	return {
		/**
		 * Get current state
		 *
		 * @return {Object} Current state
		 */
		getState() {
			return state;
		},

		/**
		 * Update state and notify listeners
		 *
		 * @param {Object} newState - Partial state to merge
		 */
		setState( newState ) {
			state = { ...state, ...newState };
			listeners.forEach( ( listener ) => listener( state ) );
		},

		/**
		 * Subscribe to state changes
		 *
		 * @param {Function} listener - Callback function
		 * @return {Function} Unsubscribe function
		 */
		subscribe( listener ) {
			listeners.add( listener );
			return () => listeners.delete( listener );
		}
	};
}
