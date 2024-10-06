import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios';

export const generateProofreadErrors = async (input: string) => {
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
		return response.data;
	} catch (error) {
		console.error('Error:', error);
		throw error;
	}
};

export function createSuggestionBox({ error, position, onReplace, onIgnore, onClose }) {
	// Remove any existing suggestion box
	const existingBox = document.querySelector('.proofread-suggestion');
	if (existingBox) {
		existingBox.remove();
	}

	// Create a container for the suggestion box
	const container = document.createElement('div');
	container.className = 'proofread-suggestion';
	container.style.position = 'fixed';
	container.style.zIndex = '50';
	container.style.backgroundColor = 'white';
	container.style.border = '1px solid #D1D5DB';
	container.style.padding = '1rem';
	container.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.06)';
	container.style.borderRadius = '0.375rem';
	container.style.maxWidth = '20rem';
	container.style.left = `${position.x}px`;
	container.style.top = `${position.y + 15}px`;

	// Create inner HTML for the suggestion box
	const content = document.createElement('div');
	content.style.display = 'flex';
	content.style.justifyContent = 'space-between';
	content.style.alignItems = 'center';
	content.style.marginBottom = '0.5rem';

	const message = document.createElement('p');
	message.style.color = '#1F2937';
	message.textContent = error.msg;

	const closeButton = document.createElement('button');
	closeButton.style.color = '#6B7280';
	closeButton.style.cursor = 'pointer';
	closeButton.style.marginTop = '-20px';
	closeButton.style.marginRight = '-12px';
	closeButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>`;
	closeButton.addEventListener('click', () => {
		container.remove();
		if (onClose) onClose();
	});

	content.appendChild(message);
	content.appendChild(closeButton);
	container.appendChild(content);

	// Add replacement suggestions if available
	if (error.replacements && error.replacements.length > 0) {
		error.replacements.slice(0, 3).forEach((replacement) => {
			const replaceButton = document.createElement('button');
			replaceButton.style.backgroundColor = '#3B82F6';
			replaceButton.style.color = 'white';
			replaceButton.style.padding = '0.25rem 0.5rem';
			replaceButton.style.borderRadius = '0.25rem';
			replaceButton.style.marginBottom = '0.25rem';
			replaceButton.style.marginRight = '0.5rem';
			replaceButton.style.cursor = 'pointer';
			replaceButton.style.border = 'none';
			replaceButton.style.outline = 'none';
			replaceButton.textContent = replacement.value;
			replaceButton.addEventListener('click', () => {
				if (onReplace) onReplace(replacement.value);
				container.remove();
			});
			container.appendChild(replaceButton);
		});
	} else {
		const noReplacement = document.createElement('p');
		noReplacement.style.color = '#9CA3AF';
		noReplacement.textContent = 'No replacements available';
		container.appendChild(noReplacement);
	}

	// Add ignore button
	const ignoreButton = document.createElement('button');
	ignoreButton.style.backgroundColor = '#6B7280';
	ignoreButton.style.color = 'white';
	ignoreButton.style.padding = '0.25rem 0.5rem';
	ignoreButton.style.borderRadius = '0.25rem';
	ignoreButton.style.marginTop = '0.5rem';
	ignoreButton.style.cursor = 'pointer';
	ignoreButton.style.border = 'none';
	ignoreButton.style.outline = 'none';
	ignoreButton.textContent = 'Ignore';
	ignoreButton.addEventListener('click', () => {
		if (onIgnore) onIgnore();
		container.remove();
	});

	container.appendChild(ignoreButton);

	// Append the container to the body
	document.body.appendChild(container);

	return {
		destroy: () => container.remove()
	};
}
