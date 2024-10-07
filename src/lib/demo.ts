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
    const existingBox = document.querySelector('.proofread-suggestion');
    if (existingBox) {
        existingBox.remove();
    }

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
    container.style.top = `${position.y}px`;
    container.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    container.style.opacity = '0';
    container.style.transform = 'translateY(-10px)';

    setTimeout(() => {
        container.style.opacity = '1';
        container.style.transform = 'translateY(0)';
    }, 10);

    const content = document.createElement('div');
    content.style.display = 'flex';
    content.style.justifyContent = 'space-between';
    content.style.alignItems = 'center';
    content.style.marginBottom = '0.5rem';

    const message = document.createElement('p');
    message.style.color = '#1F2937';
    message.style.margin = '0';
    message.style.fontSize = '1rem';
    message.style.flex = '1';
    message.textContent = error.msg;

    const closeButton = document.createElement('button');
    closeButton.style.backgroundColor = 'transparent';
    closeButton.style.border = 'none';
    closeButton.style.cursor = 'pointer';
    closeButton.style.display = 'flex';
    closeButton.style.alignItems = 'center';
    closeButton.style.justifyContent = 'center';
    closeButton.style.padding = '0';
    closeButton.style.marginLeft = '1rem';

    closeButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="24" height="24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>`;

    closeButton.addEventListener('click', () => {
        container.style.opacity = '0';
        container.style.transform = 'translateY(-10px)';
        setTimeout(() => container.remove(), 300);
        if (onClose) onClose();
    });

    content.appendChild(message);
    content.appendChild(closeButton);
    container.appendChild(content);

    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.display = 'flex';
    buttonsContainer.style.flexWrap = 'wrap';
    buttonsContainer.style.gap = '0.5rem';

    if (error.replacements && error.replacements.length > 0) {
        error.replacements.slice(0, 3).forEach((replacement) => {
            const replaceButton = document.createElement('button');
            replaceButton.style.backgroundColor = '#3B82F6';
            replaceButton.style.color = 'white';
            replaceButton.style.padding = '0.5rem 1rem';
            replaceButton.style.borderRadius = '0.375rem';
            replaceButton.style.cursor = 'pointer';
            replaceButton.style.border = 'none';
            replaceButton.style.outline = 'none';
            replaceButton.style.fontSize = '0.875rem';
            replaceButton.style.transition = 'background-color 0.2s ease';

            replaceButton.textContent = replacement.value;
            replaceButton.addEventListener('click', () => {
                if (onReplace) onReplace(replacement.value);
                container.style.opacity = '0';
                container.style.transform = 'translateY(-10px)';
                setTimeout(() => container.remove(), 300);
            });

            replaceButton.addEventListener('mouseenter', () => {
                replaceButton.style.backgroundColor = '#2563EB';
            });
            replaceButton.addEventListener('mouseleave', () => {
                replaceButton.style.backgroundColor = '#3B82F6';
            });

            buttonsContainer.appendChild(replaceButton);
        });
    } else {
        const noReplacement = document.createElement('p');
        noReplacement.style.color = '#9CA3AF';
        noReplacement.style.margin = '0';
        noReplacement.style.fontSize = '0.875rem';
        noReplacement.textContent = 'No replacements available';
        buttonsContainer.appendChild(noReplacement);
    }

    const ignoreButton = document.createElement('button');
    ignoreButton.style.backgroundColor = '#6B7280';
    ignoreButton.style.color = 'white';
    ignoreButton.style.padding = '0.5rem 1rem';
    ignoreButton.style.borderRadius = '0.375rem';
    ignoreButton.style.cursor = 'pointer';
    ignoreButton.style.border = 'none';
    ignoreButton.style.outline = 'none';
    ignoreButton.style.fontSize = '0.875rem';
    ignoreButton.style.transition = 'background-color 0.2s ease';

    ignoreButton.textContent = 'Ignore';
    ignoreButton.addEventListener('click', () => {
        if (onIgnore) onIgnore();
        container.style.opacity = '0';
        container.style.transform = 'translateY(-10px)';
        setTimeout(() => container.remove(), 300);
    });

    ignoreButton.addEventListener('mouseenter', () => {
        ignoreButton.style.backgroundColor = '#4B5563';
    });
    ignoreButton.addEventListener('mouseleave', () => {
        ignoreButton.style.backgroundColor = '#6B7280';
    });

    buttonsContainer.appendChild(ignoreButton);
    container.appendChild(buttonsContainer);

    document.body.appendChild(container);

    const handleScroll = () => {
        container.style.opacity = '0';
        container.style.transform = 'translateY(-10px)';
        setTimeout(() => container.remove(), 300);
        window.removeEventListener('scroll', handleScroll);
    };

    window.addEventListener('scroll', handleScroll);

    return {
        destroy: () => {
            window.removeEventListener('scroll', handleScroll);
            container.remove();
        }
    };
}
