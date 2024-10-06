import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios';

export const generateProofreadErrors = async (input: string): Promise<string> => {
	const headersList = {
		Accept: 'application/json',
		'Content-Type': 'application/x-www-form-urlencoded'
	};

	// Format the data for LanguageTool's API
	const bodyContent = new URLSearchParams({
		language: 'en-US',
		text: input
	}).toString();

	const reqOptions = {
		url: 'https://api.languagetool.org/v2/check',
		method: 'POST',
		headers: headersList,
		data: bodyContent
	} as AxiosRequestConfig;

	try {
		const response: AxiosResponse = await axios.request(reqOptions);
		return JSON.stringify(response.data, null, 2);
	} catch (error) {
		console.error('Error:', error);
		throw error;
	}
};

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
