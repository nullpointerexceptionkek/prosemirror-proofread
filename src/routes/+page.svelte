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
	import createSpellCheckPlugin from '$lib/spellcheckplugin.js';
  import '$lib/suggestion.css'

	let editorContainer: HTMLDivElement | null = null;
	let content: HTMLElement | null = null;
	const mySchema = new Schema({
		nodes: addListNodes(schema.spec.nodes, 'paragraph block*', 'block'),
		marks: schema.spec.marks
	});

	onMount(() => {
		if (editorContainer && content) {
			let editorview = new EditorView(editorContainer, {
				state: EditorState.create({
					doc: DOMParser.fromSchema(mySchema).parse(content),
					plugins: [...exampleSetup({ schema: mySchema }), createSpellCheckPlugin()]
				})
			});
		}
	});
</script>

<div id="content" bind:this={content}>
	<p>Hello, ProseMirror in Svelte!</p>
</div>
<div bind:this={editorContainer}></div>

<style>
	:global(.ProseMirror) {
		outline: none;
		border: none;
	}
</style>
