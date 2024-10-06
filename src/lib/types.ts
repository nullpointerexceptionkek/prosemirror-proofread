import type { Node as ProseMirrorNode } from 'prosemirror-model';

export interface ProofreadError {
	offset: number; // Starting position of the error in the text
	length: number; // Length of the problematic text
	message: string; // Detailed message explaining the error
	shortMessage?: string; // Optional short version of the message
	type: {
		typeName: 'UnknownWord' | string; // The type of the error (e.g., grammar, spelling)
	};
	replacements?: string[]; // Possible replacement suggestions for the error
}

export interface GenerateProofreadErrorsResponse {
	matches: ProofreadError[];
}

export type Problem = {
	from: number;
	to: number;
	msg: string;
	shortmsg: string;
	type: string;
	replacements: string[];
};

interface Position {
	x: number; // Horizontal position (e.g., event.clientX)
	y: number; // Vertical position (e.g., event.clientY)
}

// Type for the callback function for replacing text.
type OnReplaceCallback = (value: string) => void;

// Type for the callback function for ignoring an error.
type OnIgnoreCallback = () => void;

// Type for the callback function for closing the suggestion box.
type OnCloseCallback = () => void;

// Full type representing the argument object for createSuggestionBox.
interface SuggestionBoxOptions {
	error: Problem; // Details about the error being addressed
	position: Position; // Position for displaying the suggestion box
	onReplace: OnReplaceCallback; // Callback function to handle replacement
	onIgnore: OnIgnoreCallback; // Callback function to handle ignoring an error
	onClose: OnCloseCallback; // Callback function to handle closing the suggestion box
}
type Destroy = {
	destroy: () => void;
};

export type CreateSuggestionBox = (options: SuggestionBoxOptions) => Destroy;
export type GetCustomText = (node: ProseMirrorNode) => string;
