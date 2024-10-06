export function debounce(func, wait) {
	let timeout;

	return (...args) => {
		if (timeout) {
			clearTimeout(timeout);
		}

		timeout = setTimeout(() => {
			func.apply(this, args);
		}, wait);
	};
}


export function createSpellCheckEnabledStore(getInitialValue) {
    let spellCheckEnabled = getInitialValue();
    const subscribers = new Set<(value: boolean) => void>();

    function subscribe(subscriber: (value: boolean) => void) {
        subscribers.add(subscriber);
        subscriber(spellCheckEnabled);

        return () => subscribers.delete(subscriber);
    }

    function set(newValue) {
        if (spellCheckEnabled !== newValue) {
            spellCheckEnabled = newValue;
            subscribers.forEach(subscriber => subscriber(spellCheckEnabled));
        }
    }

    function get() {
        return spellCheckEnabled;
    }

    return {
        subscribe,
        set,
        get
    };
}
