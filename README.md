# ProseMirror-proofread

**ProseMirror-proofread** is a plugin for adding spell-check and grammar-checking capabilities to your ProseMirror editor. This library helps you to integrate with a variety of spell-check services, including LanguageTool. This library is designed to handle caching, ignore, and pop-ups. It is up to the developer's responsibility to implement UI and spell checking services. In the example, example integration with LanguageTool and an example UI are provided, which can be a good starting point.

## Features

- **Spell Checking and Grammar Correction**: Identifies spelling errors, grammatical mistakes, and suggests potential corrections. By default, ProseMirror-proofread is designed to work with LanguageTool, but integrating with other tool is also possible.
- **Debounced Spell Check Requests**: Customizable debounce to control the frequency of error generation, ensuring smooth performance.
- **Customizable Suggestion Box**: The library provides the ability to easily customize the UI for error suggestions.
- **Reactive Spell Check Enable/Disable**: Built-in functionality to easily toggle spell-checking on or off.

## Usage

### Getting Started

To use **ProseMirror-proofread**, simply import the main plugin and integrate it with your ProseMirror setup. This library provides essential tools to create a high-quality proofreading experience within your editor.

Example setup for integrating **ProseMirror-proofread**:

```typescript
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { Schema } from 'prosemirror-model';
import { schema } from 'prosemirror-schema-basic';
import { addListNodes } from 'prosemirror-schema-list';
import { exampleSetup } from 'prosemirror-example-setup';
import createProofreadPlugin from 'prosemirror-proofread';

const mySchema = new Schema({
	nodes: addListNodes(schema.spec.nodes, 'paragraph block*', 'block'),
	marks: schema.spec.marks
});

const editorContainer = document.querySelector('#editor');
const proofreadPlugin = createProofreadPlugin(
	1000, // Debounce time in ms
	generateProofreadErrors, // function to call proofreading service
	createSuggestionBox, // Suggestion box function
	spellCheckEnabledStore, // Reactive store to toggle spell checking
	getCustomText // Might need to Override to handle some edge case with inline nodes
);

new EditorView(editorContainer, {
	state: EditorState.create({
		schema: mySchema,
		plugins: [...exampleSetup({ schema: mySchema }), proofreadPlugin]
	})
});
```

# Proofreading API Reference

This API reference provides details on how to implement the core proofreading functionalities using `createProofreadPlugin` and `createSpellCheckEnabledStore`.

## createProofreadPlugin

`createProofreadPlugin(debounceTimeMS, generateProofreadErrors, createSuggestionBox, getSpellCheckEnabled, getCustomText?)`


- **debounceTimeMS** (number): Time delay(ms) before processing the text to reduce redundant calls.
- **generateProofreadErrors** (function): function that calls your custom proofreading service.
- **createSuggestionBox** (function): your custom suggestionbox UI.
- **getSpellCheckEnabled**: Acts like a Svelte Store, reactively responds to toggle on and off.
- **getCustomText** (optional): You might need to override this if you have edge cases regarding inline nodes.


## createSpellCheckEnabledStore

`createSpellCheckEnabledStore(initialValue: boolean)`

### Example

```typescript
const spellCheckStore = createSpellCheckEnabledStore(true);
spellCheckStore.set(false); // Disables spell check
console.log(spellCheckStore.get()); // Outputs: false
```

## generateProofreadErrors

`generateProofreadErrors: (text: string) => GenerateProofreadErrorsResponse`

The `generateProofreadErrors` function takes a block of text as input and returns information about any identified errors, including their positions, type, and potential corrections.

### Parameters

- **text** (string): The text to be analyzed for errors.

### Response

- **GenerateProofreadErrorsResponse**: An object containing a list of proofreading issues detected within the input text.
  - **matches** (ProofreadError[]): An array of `ProofreadError` objects, each representing an individual error found.

### ProofreadError Object

The `ProofreadError` object provides detailed information about a specific error:

- **offset** (number): The starting position of the error in the text.
- **length** (number): The length of the problematic text.
- **message** (string): A detailed explanation of the error.
- **shortMessage** (string, optional): A concise version of the error message.
- **type** (object):
  - **typeName** ('UnknownWord' | string): The type of the error (e.g., "UnknownWord" for spelling issues, or other custom types).
- **replacements** (string[], optional): Suggested corrections for the error, if available.

### Example
Please note that this library supports the LangaugeTool output by default, if you use a different service, you will need to format them like LanguageTool.
```typescript
{
  matches: [
    {
      offset: 0,
      length: 3,
      message: "Possible spelling mistake found.",
      shortMessage: "Spelling error",
      type: { typeName: "UnknownWord" },
      replacements: ["This"]
    },
    {
      offset: 11,
      length: 6,
      message: "Possible spelling mistake found.",
      type: { typeName: "UnknownWord" },
      replacements: ["example"]
    }
  ]
}
```

## createSuggestionBox

`createSuggestionBox: (options: SuggestionBoxOptions) => Destroy`

The `createSuggestionBox` function is used to create an interactive suggestion box that allows users to view and act on the proofreading suggestions. This function generates UI elements to provide replacement suggestions or ignore actions.

### Parameters

- **options** (SuggestionBoxOptions): An object containing details about how to display the suggestion box and handle user interactions.

### SuggestionBoxOptions Object

The `SuggestionBoxOptions` object provides the necessary details for configuring the suggestion box:

- **error** (Problem): Details about the error being addressed, usually derived from the output of `generateProofreadErrors`.
- **position** (Position): The position on the screen where the suggestion box should appear.
  - **Position** includes:
    - **x** (number): Horizontal position (e.g., `event.clientX`).
    - **y** (number): Vertical position (e.g., `event.clientY`).
- **onReplace** (OnReplaceCallback): A callback function that handles the replacement of the text. It takes a `value` (string) to replace the erroneous text.
- **onIgnore** (OnIgnoreCallback): A callback function that handles ignoring the identified error.
- **onClose** (OnCloseCallback): A callback function that handles closing the suggestion box.

### Example

```typescript
createSuggestionBox({
	error: {
		offset: 0,
		length: 3,
		message: 'Possible spelling mistake found.'
	},
	position: { x: 100, y: 200 },
	onReplace: (value) => {
		console.log('Replaced with: ', value);
	},
	onIgnore: () => {
		console.log('Ignored the error.');
	},
	onClose: () => {
		console.log('Closed the suggestion box.');
	}
});
```
