export { createSuggestionBox } from './demo.js';
import createProofreadPlugin from './proofreadPlugin.js';
import { createSpellCheckEnabledStore } from './utils.js';
export { createProofreadPlugin };
export { createSpellCheckEnabledStore };
export { invalidateProofreadCache } from './proofreadPlugin.js';
export type {
	ProofreadError,
	GenerateProofreadErrorsResponse,
	Problem,
	Segment,
	CreateSuggestionBox,
	GetCustomText
} from './types.js';
