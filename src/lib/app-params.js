const isNode = typeof window === 'undefined';
const windowObj = isNode ? { localStorage: new Map() } : window;
const storage = windowObj.localStorage;

const toSnakeCase = (str) => {
	return str.replace(/([A-Z])/g, '_$1').toLowerCase();
};

const getAppParamValue = (paramName, { defaultValue = undefined, removeFromUrl = false } = {}) => {
	if (isNode) {
		return defaultValue;
	}
	const storageKey = `app_${toSnakeCase(paramName)}`;
	const urlParams = new URLSearchParams(window.location.search);
	const searchParam = urlParams.get(paramName);
	if (removeFromUrl) {
		urlParams.delete(paramName);
		const newUrl = `${window.location.pathname}${urlParams.toString() ? `?${urlParams.toString()}` : ""
			}${window.location.hash}`;
		window.history.replaceState({}, document.title, newUrl);
	}
	if (searchParam) {
		storage.setItem(storageKey, searchParam);
		return searchParam;
	}
	if (defaultValue !== undefined && defaultValue !== null) {
		storage.setItem(storageKey, String(defaultValue));
		return defaultValue;
	}
	const storedValue = storage.getItem(storageKey);
	if (storedValue) {
		return storedValue;
	}
	return null;
};

const getAppParams = () => {
	return {
		appId: import.meta.env.VITE_APP_ID || 'cassa-binengo',
		token: getAppParamValue('access_token', { removeFromUrl: true }) || null,
		fromUrl: getAppParamValue('from_url', { defaultValue: window.location.href }),
		functionsVersion: import.meta.env.VITE_FUNCTIONS_VERSION || 'v1',
		appBaseUrl: import.meta.env.VITE_APP_BASE_URL || window.location.origin,
	};
};

export const appParams = {
	...getAppParams(),
};
