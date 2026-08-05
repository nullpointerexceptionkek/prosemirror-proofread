# ProseMirror-proofread
![NPM Version](https://img.shields.io/npm/v/prosemirror-proofread) ![Static Badge](https://img.shields.io/badge/License-MIT-blue)

> Note: This project is still actively maintained, and I will respond to bug reports/feature requests.

**ProseMirror-proofread** is a plugin for adding spell-check and grammar-checking capabilities to your ProseMirror editor. This library helps you integrate a variety of spell-check services, including LanguageTool. This library is designed to handle caching, ignore, and pop-ups. It is up to the developer's responsibility to implement UI and spell-checking services. In the example, an example integration with LanguageTool and an example UI are provided, which can be a good starting point.


The main difficulty of creating a spell-checking library for ProseMirror, which handles ProseMirror's particular index. Most spell-checking services are designed to handle plain text, and mapping between a rich ProseMirror document to plain text and vice versa is complex.

To do so, the library checks each node individually and caches the results. As for inline nodes, the library will add filler characters by default. However, this might need to be overridden for some particular inline nodes.


This library is designed to work on all frameworks.

## Features

- **Spell Checking and Grammar Correction**: This depends on your chosen spell check provider. This library does not handle spellcheck by itself; it handles the integration of spellcheck services. You will need to override the `generateProofreadErrors` function. This library works highly well with LanguageTool but also works with other services.
- **Debounced Spell Check Requests**: Customizable debounce to control the frequency of error generation, ensuring smooth performance.
- **Customizable Suggestion Box**: The library provides the ability to easily customize the UI for error suggestions.
- **Reactive Spell Check Enable/Disable**: Built-in functionality to easily toggle spell-checking on or off.


We offer a default UI box as shown in the demo link:[https://louisqli.github.io/prosemirror-proofread/]

## Usage

```
npm i prosemirror-proofread
```

### Getting Started

To use **ProseMirror-proofread**, simply import the main plugin and integrate it with your ProseMirror setup. This library provides essential tools to create a high-quality proofreading experience within your editor.

Example setup for integrating **ProseMirror-proofread**:

We offer a [React example](demos/reacttest/src/App.tsx)

> **IMPORTANT**: Make sure to import the CSS for suggestions.
> ```typescript
> import 'prosemirror-proofread/suggestions.css';
> ```

```typescript
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { Schema } from 'prosemirror-model';
import { schema } from 'prosemirror-schema-basic';
import { addListNodes } from 'prosemirror-schema-list';
import { exampleSetup } from 'prosemirror-example-setup';
import { createProofreadPlugin } from 'prosemirror-proofread';

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

`createProofreadPlugin(debounceTimeMS, generateProofreadErrors, createSuggestionBox, getSpellCheckEnabled, getCustomText?, useCustomCSS?)`


- **debounceTimeMS** (number): Time delay(ms) before processing the text to reduce redundant calls.
- **generateProofreadErrors** (function): the function that calls your custom proofreading service.
- **createSuggestionBox** (function): your custom suggestionbox UI.
- **getSpellCheckEnabled**: Acts like a Svelte Store, reactively responds to toggle on and off.
- **getCustomText** (optional): You might need to override this if you have edge cases regarding inline nodes.
- **useCustomCSS** (optional boolean): When `true`, uses `proofread-{errortype}` class naming convention instead of default `spelling-error`/`spelling-warning`. Default: `false`


## createSpellCheckEnabledStore

`createSpellCheckEnabledStore(initialValue: () => boolean)`

### Example

```typescript
const spellCheckStore = createSpellCheckEnabledStore(()=>{true});
spellCheckStore.set(false); // Disables spell check
console.log(spellCheckStore.get()); // Outputs: false
```

## generateProofreadErrors

`generateProofreadErrors: (text: string) => GenerateProofreadErrorsResponse | Promise<GenerateProofreadErrorsResponse>`

The `generateProofreadErrors` function takes a block of text as input and returns (or returns a Promise that resolves to) information about any identified errors, including their positions, type, and potential corrections. This function can be either synchronous or asynchronous.

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
      replacements: [{"value":"This"}] // The default suggestion box requires this format
    },
    {
      offset: 11,
      length: 6,
      message: "Possible spelling mistake found.",
      type: { typeName: "UnknownWord" },
      replacements: ["example"] // However, if you make a custom suggestion box, you can format it however you want.
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

## Custom CSS Class Names

By default, the plugin uses two CSS classes for styling errors:
- `spelling-error` for errors with type `'UnknownWord'`
- `spelling-warning` for all other error types

### Using Custom CSS (`useCustomCSS: true`)

When you set `useCustomCSS` to `true`, the plugin automatically generates class names based on the error type using the pattern: `proofread-{errortype}`

The error type is converted to lowercase and non-alphanumeric characters are replaced with hyphens.

#### Examples:

| Error Type | Generated Class Name |
|-----------|---------------------|
| `UnknownWord` | `proofread-unknownword` |
| `GRAMMAR` | `proofread-grammar` |
| `TYPO` | `proofread-typo` |
| `Misspelling_Error` | `proofread-misspelling-error` |

#### Usage Example:

```typescript
const plugin = createProofreadPlugin(
	1000,
	generateProofreadErrors,
	createSuggestionBox,
	spellCheckStore,
	undefined,  // getCustomText
	true        // useCustomCSS - enable custom class naming
);
```

#### Custom Styling:

Create your own CSS to style the errors:

```css
/* Style spelling errors */
.proofread-unknownword {
	background-color: #ffe0e0;
	border-bottom: 2px dotted red;
}

/* Style grammar errors */
.proofread-grammar {
	background-color: #e0f0ff;
	border-bottom: 2px dotted blue;
}

/* Style any other error type */
.proofread-typo {
	background-color: #fff0e0;
	border-bottom: 2px dotted orange;
}

/* Add hover effects */
[class^="proofread-"]:hover {
	opacity: 0.8;
	cursor: pointer;
}
```

**Note:** When `useCustomCSS` is `false` (default), you should import the default CSS:
```typescript
import 'prosemirror-proofread/suggestion.css';
```

# MIT License 
