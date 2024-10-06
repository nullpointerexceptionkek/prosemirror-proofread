<script lang="ts">
	import { onMount } from 'svelte';
	import { EditorState } from 'prosemirror-state';
	import { EditorView } from 'prosemirror-view';
	import { Schema, DOMParser } from 'prosemirror-model';
	import { schema } from 'prosemirror-schema-basic';
	import { addListNodes } from 'prosemirror-schema-list';
	import { exampleSetup } from 'prosemirror-example-setup';
	import 'prosemirror-example-setup/style/style.css';
	import 'prosemirror-menu/style/menu.css';
	import createSpellCheckPlugin from '$lib/proofreadPlugin.js';
	import '$lib/suggestion.css';
	import { createSuggestionBox, generateProofreadErrors } from '$lib/demo.js';
	import { createSpellCheckEnabledStore } from '$lib/utils.js';

	let editorContainer: HTMLDivElement | null = null;
	let content: HTMLElement | null = null;
	const mySchema = new Schema({
		nodes: addListNodes(schema.spec.nodes, 'paragraph block*', 'block'),
		marks: schema.spec.marks
	});

	let spellCheckEnabledStore = createSpellCheckEnabledStore(() => true);
	let spellCheckEnabled = spellCheckEnabledStore.get();

	onMount(() => {
		if (editorContainer && content) {
			new EditorView(editorContainer, {
				state: EditorState.create({
					doc: DOMParser.fromSchema(mySchema).parse(content),
					plugins: [
						...exampleSetup({ schema: mySchema }),
						createSpellCheckPlugin(
							1000,
							generateProofreadErrors as never,
							createSuggestionBox,
							spellCheckEnabledStore
						)
					]
				})
			});
		}

		spellCheckEnabledStore.subscribe((enabled) => {
			spellCheckEnabled = enabled;
		});
	});

	function toggleSpellCheck() {
		spellCheckEnabledStore.set(!spellCheckEnabled);
	}
</script>

<div id="content" bind:this={content} style="display: none">
	<p>
		This is a test of the ProseMirror editor. It have many spellng and gramar mistakes to
		test the spellcheck plugin.
	</p>
	<p>
		Here is another pargraph with more mistakes. Lets see how well the plugin can catch these erors.
	</p>
	<p>Ths sentence is missing some leters and has incorect punctuation</p>
	<p>
		Finaly, this is the last pargraph with a few more mistakes to make sure everything is working
		corectly.
	</p>
</div>

<div spellcheck="false" bind:this={editorContainer}></div>

<button on:click={toggleSpellCheck}>
	{spellCheckEnabled ? 'Disable Spell Check' : 'Enable Spell Check'}
</button>

<style>
	:global(.ProseMirror) {
		outline: none;
		border: none;
	}
</style>
