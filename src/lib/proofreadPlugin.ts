/* eslint-disable @typescript-eslint/no-explicit-any */
import { EditorState, Plugin, PluginKey, TextSelection, Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet, EditorView } from 'prosemirror-view';
import { Node as ProseMirrorNode } from 'prosemirror-model';
import hash from 'object-hash';
import { ChangeSet } from 'prosemirror-changeset';
import { createSpellCheckEnabledStore, debounce } from './utils.js';
import type {
	CreateSuggestionBox,
	GenerateProofreadErrorsResponse,
	GetCustomText,
	Problem,
	Segment
} from './types.js';

type CacheText = {
	problems: Problem[];
	text: string;
};

interface SpellPluginState {
	cacheMap: Map<string, CacheText>;
	decor: DecorationSet;
	ignoredErrors: Map<string, boolean>;
	spellcheckEnabled: boolean;
}

function generateNodeKey(node: ProseMirrorNode) {
	return hash({
		content: node.textContent
	});
}

function generateErrorKey(error: Problem): string {
	const keyContent = `${error.from}-${error.to}-${hash(error.msg)}`;
	return keyContent;
}

/**
 * Creates non-overlapping segments based on overlapping errors.
 * https://github.com/remirror/remirror/blob/next/packages/%40remirror/extension-annotation/src/segments.ts
 * Adapted from Remirror's toSegments function to handle ProseMirror decorations.
 * This allows multiple errors to be displayed correctly without decoration conflicts.
 */
function toSegments(errors: Problem[]): Segment[] {
	interface Item {
		type: 'start' | 'end';
		error: Problem;
		id: string;
	}

	const segments: Segment[] = [];
	const positionMap: Map<number, Item[]> = new Map();

	// Build position map with start and end events for each error
	for (const error of errors) {
		const id = generateErrorKey(error);
		const currentFrom = positionMap.get(error.from) ?? [];
		const currentTo = positionMap.get(error.to) ?? [];

		positionMap.set(error.from, [...currentFrom, { type: 'start', error, id }]);
		positionMap.set(error.to, [...currentTo, { type: 'end', error, id }]);
	}

	// Sort positions from smallest to largest
	const sortedPositions = [...positionMap.entries()].sort(([a], [b]) => a - b);

	// Track currently active errors
	let activeErrors: Problem[] = [];
	let from = 0;

	for (const [to, items] of sortedPositions) {
		const startErrors = items.filter((item) => item.type === 'start').map((item) => item.error);
		const endIds = new Set(items.filter((item) => item.type === 'end').map((item) => item.id));

		// Create segment for currently active errors (if any)
		if (activeErrors.length > 0) {
			segments.push({ from, to, errors: activeErrors });
		}

		// Update from position for next segment
		from = to;

		// Update active errors: add new starts and remove ends
		activeErrors = [...activeErrors, ...startErrors].filter(
			(error) => !endIds.has(generateErrorKey(error))
		);
	}

	return segments;
}

const spellcheckkey = new PluginKey('proofreadPlugin');

/**
 * Invalidates the cache for the proofread plugin, forcing a re-check.
 * Useful after adding words to a custom dictionary or changing proofreading rules.
 *
 * @param view - The EditorView instance
 */
export function invalidateProofreadCache(view: EditorView) {
	const pluginState = spellcheckkey.getState(view.state);
	if (pluginState) {
		// Clear the cache
		pluginState.cacheMap.clear();

		// Force a proofread check
		const tr = view.state.tr;
		tr.setMeta('forceProofread', true);
		view.dispatch(tr);
	}
}

export function createProofreadPlugin(
	debounceTimeMS: number,
	generateProofreadErrors: (
		text: string
	) => GenerateProofreadErrorsResponse | Promise<GenerateProofreadErrorsResponse>,
	createSuggestionBox: CreateSuggestionBox,
	getSpellCheckEnabled: ReturnType<typeof createSpellCheckEnabledStore>,
	getCustomText?: GetCustomText,
	useCustomCSS?: boolean
) {
	const debouncedCheck = debounce(check, debounceTimeMS);
	let editorview: EditorView = undefined;

	function showSuggestionBox(
		event: MouseEvent,
		errors: Problem[],
		view: EditorView,
		decor: Decoration
	) {
		// Pass all errors in the segment to the suggestion box
		// The first error is also passed separately for backwards compatibility
		const errorDetails = errors[0];

		const rect = (event.target as HTMLElement).getBoundingClientRect();

		const app = createSuggestionBox({
			error: errorDetails,
			errors: errors, // Pass all errors in this segment
			position: { x: rect.left, y: rect.bottom },
			invalidateCache: () => {
				// Invalidate cache and force re-check
				const pluginState = spellcheckkey.getState(view.state);
				if (pluginState) {
					pluginState.cacheMap.clear();
					const tr = view.state.tr;
					tr.setMeta('forceProofread', true);
					view.dispatch(tr);
				}
			},
			onReplace: (value: string | any[]) => {
				const { from, to } = decor;
				const tr = view.state.tr;
				tr.replaceWith(from, to, view.state.schema.text(value as string));

				const newSelection = TextSelection.create(tr.doc, from, from + value.length);
				const pluginState = spellcheckkey.getState(view.state);

				// Remove the decoration for this segment (which contains all errors in the segment)
				const errorKeys = decor.spec.keys;
				pluginState.decor = pluginState.decor.remove(
					pluginState.decor.find(from, to).filter((decoration: { spec: { keys: string[] } }) => {
						// Remove decorations that match any of the keys in this segment
						return (
							decoration.spec.keys &&
							decoration.spec.keys.some((k: string) => errorKeys.includes(k))
						);
					})
				);
				tr.setSelection(newSelection);
				view.dispatch(tr);
				app.destroy();
			},
			onIgnore: () => {
				const pluginState = spellcheckkey.getState(view.state);
				const { from, to } = decor;

				// Mark all errors in this segment as ignored
				errors.forEach((error) => {
					pluginState.ignoredErrors.set(generateErrorKey(error), true);
				});

				// Remove the decoration for this segment
				const errorKeys = decor.spec.keys;
				pluginState.decor = pluginState.decor.remove(
					pluginState.decor.find(from, to).filter((decoration: { spec: { keys: string[] } }) => {
						return (
							decoration.spec.keys &&
							decoration.spec.keys.some((k: string) => errorKeys.includes(k))
						);
					})
				);

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

	function shouldProofreadNode(node: ProseMirrorNode) {
		// Only proofread block nodes that can contain text (paragraph, heading, etc.)
		// Skip nodes that are primarily structural or contain non-text content
		if (!node.isBlock) {
			return false;
		}

		// Check if the node has any non-inline children (nested blocks)
		let hasNestedBlocks = false;
		node.forEach((child) => {
			if (child.isBlock) {
				hasNestedBlocks = true;
				return false;
			}
		});

		// If it has nested blocks, let those blocks be processed individually
		return !hasNestedBlocks;
	}

	async function proofread(text: string): Promise<Problem[]> {
		// console.log('proofreading: ' + text);
		const response = await generateProofreadErrors(text);
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
				replacements: error.replacements,
				text: text.substring(error.offset, error.offset + error.length)
			});
		}
		return problems;
	}

	async function check(
		doc: ProseMirrorNode,
		pluginState: SpellPluginState,
		editorView: EditorView
	) {
		const decorations: Decoration[] = [];
		const processErrors = (errors: any[], offset: number, ignoredErrors: Map<string, boolean>) => {
			// Filter out ignored errors first
			const activeErrors = errors.filter((error) => !ignoredErrors.has(generateErrorKey(error)));

			// Convert overlapping errors to non-overlapping segments
			const segments = toSegments(activeErrors);

			segments.forEach((segment) => {
				// Determine class name based on errors in the segment
				// Priority: if any error is UnknownWord, use spelling-error, otherwise spelling-warning
				const hasSpellingError = segment.errors.some((e) => e.type === 'UnknownWord');
				const classname = useCustomCSS
					? `proofread-${segment.errors[0].type.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
					: hasSpellingError
						? 'spelling-error'
						: 'spelling-warning';

				// Generate keys for all errors in this segment
				const errorKeys = segment.errors.map(generateErrorKey);

				decorations.push(
					Decoration.inline(
						segment.from + offset,
						segment.to + offset,
						{ class: classname },
						{ errors: segment.errors, keys: errorKeys }
					)
				);
			});
		};

		const tasks: (() => Promise<void>)[] = [];
		doc.descendants((node, pos) => {
			// shouldProofreadNode returns true for block nodes without nested blocks (e.g., paragraphs)
			// return true here means "continue to children" - this allows descending into lists, tables, etc.
			// return false means "stop this branch" - prevents further descent after processing a node
			if (!shouldProofreadNode(node)) {
				return true; // Skip this node, but continue to children (e.g., descend into lists/tables)
			}
			tasks.push(async () => {
				if (node.textContent && node.textContent.length > 1) {
					const nodeKey = generateNodeKey(node);

					if (!pluginState.cacheMap.has(nodeKey)) {
						const errors = await proofread(getCustomText?.(node) ?? getDefaultCustomText(node));
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

	return new Plugin<SpellPluginState>({
		key: spellcheckkey,
		view(view) {
			editorview = view;
			//account for the inital element in the editor
			if (getSpellCheckEnabled.get()) {
				setTimeout(() => {
					const tr = view.state.tr;
					tr.setMeta('forceProofread', true);
					view.dispatch(tr);
				}, 100);
			}

			const unsubscribe = getSpellCheckEnabled.subscribe((value) => {
				const spellcheckEnabled = value;
				const tr = view.state.tr;
				tr.setMeta('updateSpellcheckEnabled', spellcheckEnabled);
				view.dispatch(tr);
			});
			return {
				destroy() {
					unsubscribe();
				}
			};
		},
		state: {
			init() {
				return {
					cacheMap: new Map<string, CacheText>(),
					ignoredErrors: new Map<string, boolean>(),
					decor: DecorationSet.empty,
					spellcheckEnabled: getSpellCheckEnabled.get()
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

				const forceProofread = tr.getMeta('forceProofread');

				if (!tr.docChanged && spellcheckEnabled === old.spellcheckEnabled && !forceProofread)
					return old;

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
					// Now we pass the errors array instead of a single error
					const errors = decorationsAtPos[0].spec.errors;
					showSuggestionBox(event, errors, view, decorationsAtPos[0]);
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

//this is to account for the 2 extra index in prosemirror inline node
function getDefaultCustomText(node: ProseMirrorNode) {
	let textContent = '';

	node.content.forEach((child) => {
		if (child.isText) {
			textContent += child.text;
		} else if (child.isInline) {
			textContent += `$${getDefaultCustomText(child)}$`;
		} else {
			textContent += getDefaultCustomText(child);
		}
	});
	return textContent;
}

export default createProofreadPlugin;
