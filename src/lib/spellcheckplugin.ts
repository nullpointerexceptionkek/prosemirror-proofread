/* eslint-disable @typescript-eslint/no-explicit-any */
import { EditorState, Plugin, PluginKey, TextSelection, Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet, EditorView } from 'prosemirror-view';
import { Node as ProseMirrorNode } from 'prosemirror-model';
import hash from 'object-hash';
import { ChangeSet } from 'prosemirror-changeset';
import { createSuggestionBox } from './suggestionbox.js';
import { debounce, generateProofreadErrors } from './utils.js';

type Problem = {
	from: number;
	to: number;
	msg: string;
	shortmsg: string;
	type: string;
	replacements: [];
};

type CacheText = {
	problems: Problem[];
	text: string;
};

function generateNodeKey(node: ProseMirrorNode) {
	return hash({
		content: node.textContent
	});
}

function generateErrorKey(error: Problem): string {
	const keyContent = `${error.from}-${error.to}-${hash(error.msg)}`;
	return keyContent;
}

const spellcheckkey = new PluginKey('spellCheckPlugin');

async function proofread(text: string): Promise<Problem[]> {
	console.log('proofreading: ' + text);
	const response: any = JSON.parse(await generateProofreadErrors(text));
	const data = response;
	const errors = data.matches;
	const problems: Problem[] = [];
	if (!Array.isArray(errors)) {
		return [];
	}
	for (const error of errors) {
		problems.push({
			from: error.offset,
			to: error.offset + error.length,
			msg: error.message,
			shortmsg: error.shortMessage,
			type: error.type.typeName,
			replacements: error.replacements
		});
	}
	return problems;
}

interface SpellPluginState {
	cacheMap: Map<string, CacheText>;
	decor: DecorationSet;
	ignoredErrors: Map<string, boolean>;
	spellcheckEnabled: boolean;
}

async function check(doc: ProseMirrorNode, pluginState: SpellPluginState, editorView: EditorView) {
	const decorations: Decoration[] = [];
	const processErrors = (errors: any[], offset: number, ignoredErrors: Map<string, boolean>) => {
		errors.forEach((error) => {
			const errorKey = generateErrorKey(error);
			if (!ignoredErrors.has(errorKey)) {
				const classname = error.type === 'UnknownWord' ? 'spelling-error' : 'spelling-warning';
				decorations.push(
					Decoration.inline(
						error.from + offset,
						error.to + offset,
						{ class: classname },
						{ error, key: errorKey }
					)
				);
			}
		});
	};

	const tasks: (() => Promise<void>)[] = [];
	doc.descendants((node, pos) => {
		if (!containsOnlyTextNodes(node)) {
			return true;
		}
		tasks.push(async () => {
			if (node.textContent && node.textContent.length > 1) {
				const nodeKey = generateNodeKey(node);

				if (!pluginState.cacheMap.has(nodeKey)) {
					const errors = await proofread(getCustomText(node));
					pluginState.cacheMap.set(nodeKey, { problems: errors, text: node.textContent });
				}

				const offset = pos + 1;
				processErrors(
					pluginState.cacheMap.get(nodeKey)?.problems || [],
					offset,
					pluginState.ignoredErrors
				);
			}
		});
		return false;
	});

	for (const task of tasks) {
		await task();
	}
	pluginState.decor = DecorationSet.create(doc, decorations);
	const tr = editorView.state.tr;
	tr.setMeta('proofread', pluginState);
	editorView.dispatch(tr);
}

const debouncedCheck = debounce(check, 1000);

// Create the spell check plugin
export function createSpellCheckPlugin() {
	let editorview: EditorView = undefined;
	return new Plugin<SpellPluginState>({
		key: spellcheckkey,
		view(view) {
			editorview = view
			return {};
		},
		state: {
			init() {
				return {
					cacheMap: new Map<string, CacheText>(),
					ignoredErrors: new Map<string, boolean>(),
					decor: DecorationSet.empty,
					spellcheckEnabled: true,
				};
			},
			apply(tr: Transaction, old: SpellPluginState, oldState, newState) {
				const spellcheckEnabledMeta = tr.getMeta('updateSpellcheckEnabled');
				let spellcheckEnabled = old.spellcheckEnabled;

				if (typeof spellcheckEnabledMeta !== 'undefined') {
					spellcheckEnabled = spellcheckEnabledMeta;
				}

				if (spellcheckEnabled === false) {
					return {
						...old,
						spellcheckEnabled,
						decor: DecorationSet.empty
					};
				}

				const asyncDecros = tr.getMeta('proofread');
				if (asyncDecros) {
					return asyncDecros;
				}

				if (!tr.docChanged && spellcheckEnabled === old.spellcheckEnabled) return old;

				getOldNodes([tr], oldState).forEach((changednode) => {
					old.cacheMap.delete(generateNodeKey(changednode.node));
				});
				const newIgnoredErrors = new Map<string, boolean>();
				old.ignoredErrors.forEach((value, key) => {
					const [from, to, msgHash] = key.split('-');
					const mappedFrom = tr.mapping.map(parseInt(from));
					const mappedTo = tr.mapping.map(parseInt(to));
					const newKey = `${mappedFrom}-${mappedTo}-${msgHash}`;
					newIgnoredErrors.set(newKey, true);
				});

				const newDeco = old.decor.map(tr.mapping, tr.doc);
				debouncedCheck(
					newState.doc,
					{
						cacheMap: old.cacheMap,
						decor: newDeco,
						ignoredErrors: newIgnoredErrors,
						spellcheckEnabled: spellcheckEnabled
					},
					editorview
				);

				return {
					cacheMap: old.cacheMap,
					decor: newDeco,
					ignoredErrors: newIgnoredErrors,
					spellcheckEnabled
				};
			}
		},
		props: {
			decorations(state) {
				return this.getState(state)?.decor;
			},
			handleClick(view, pos, event) {
				const decorationSet: DecorationSet = spellcheckkey.getState(view.state).decor;
				const decorationsAtPos = decorationSet.find(pos, pos);

				if (decorationsAtPos && decorationsAtPos.length >= 1) {
					showSuggestionBox(event, decorationsAtPos[0].spec.error, view, decorationsAtPos[0]);
				} else {
					const existingBox = document.querySelector('.proofread-suggestion');
					if (existingBox) {
						existingBox.remove();
					}
				}
			},
			handleKeyDown() {
				const existingBox = document.querySelector('.proofread-suggestion');
				if (existingBox) {
					existingBox.remove();
				}
			}
		}
	});
}

// Helper functions

function getOldNodes(transactions: Transaction[], prevState: EditorState) {
	let changeSet = ChangeSet.create(prevState.doc);

	for (const txn of transactions.filter((txn) => txn.docChanged)) {
		changeSet = changeSet.addSteps(
			changeSet.startDoc,
			txn.steps.map((step) => step.getMap()),
			[]
		);
	}

	const oldNodes: { node: ProseMirrorNode; pos: number }[] = [];

	for (const change of changeSet.changes) {
		const start = change.fromA;
		const end = change.toA;
		prevState.doc.nodesBetween(start, end, (node, pos) => {
			oldNodes.push({
				node,
				pos
			});
			return false;
		});
	}
	return oldNodes;
}

function showSuggestionBox(
	event: MouseEvent,
	errorDetails: Problem,
	view: EditorView,
	decor: Decoration
) {
	const errorKey = generateErrorKey(errorDetails);

	const app = createSuggestionBox({
		error: errorDetails,
		position: { x: event.clientX, y: event.clientY },
		onReplace: (value: string | any[]) => {
			const { from, to } = decor;
			const tr = view.state.tr;
			tr.replaceWith(from, to, view.state.schema.text(value as string));

			const newSelection = TextSelection.create(tr.doc, from, from + value.length);
			const pluginState = spellcheckkey.getState(view.state);

			pluginState.decor = pluginState.decor.remove(
				pluginState.decor
					.find(from, to)
					.filter((decoration: { spec: { key: string } }) => decoration.spec.key === errorKey)
			);
			tr.setSelection(newSelection);
			view.dispatch(tr);
			app.destroy();
		},
		onIgnore: () => {
			const pluginState = spellcheckkey.getState(view.state);
			const { from, to } = decor;
			pluginState.decor = pluginState.decor.remove(
				pluginState.decor
					.find(from, to)
					.filter((decoration: { spec: { key: string } }) => decoration.spec.key === errorKey)
			);
			pluginState.ignoredErrors.set(errorKey, true);
			const tr = view.state.tr;
			tr.setMeta('proofread', pluginState);
			view.dispatch(tr);
			app.destroy();
		},
		onClose: () => {
			app.destroy();
		}
	});

	return app;
}

function containsOnlyTextNodes(node: ProseMirrorNode) {
	let onlyText = true;

	node.forEach((child) => {
		if (!child.isText && child.type.name !== 'inline_math') {
			onlyText = false;
			return false;
		}
	});

	return onlyText;
}

function getCustomText(node: ProseMirrorNode) {
	let textContent = '';

	node.content.forEach((child) => {
		if (child.type.name === 'inline_math') {
			textContent += `$${child.textContent}$`;
		} else if (child.type.name === 'citation') {
			textContent += `[${child.textContent}]`;
		} else if (child.isText) {
			textContent += child.text;
		} else {
			textContent += getCustomText(child);
		}
	});

	return textContent;
}

export default createSpellCheckPlugin;
