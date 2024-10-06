<script>
	export let error;
	export let position;
	export let onReplace;
	export let onIgnore;
	export let onClose;

	function replaceText(value) {
		onReplace(value);
	}

	function ignoreSuggestion() {
		onIgnore();
	}

	function closeBox() {
		onClose();
	}
</script>

<div
	class="proofread-suggestion fixed z-50 bg-white border border-gray-300 p-4 shadow-lg rounded-md max-w-sm"
	style="left: {position.x}px; top: {position.y + 15}px"
>
	<div class="flex justify-between items-center mb-2">
		<p class="text-gray-800">{error.msg}</p>
		<button on:click={closeBox} class="text-gray-500 hover:text-gray-700 focus:outline-none">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-6 w-6"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				style="margin-top: -20px; margin-right: -12px;"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M6 18L18 6M6 6l12 12"
				/>
			</svg>
		</button>
	</div>
	{#if error.replacements && error.replacements.length > 0}
		{#each error.replacements.slice(0, 3) as replacement}
			<button
				class="bg-blue-500 text-white py-1 px-2 rounded mb-1 mr-2 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
				on:click={() => replaceText(replacement.value)}
			>
				{replacement.value}
			</button>
		{/each}
	{:else}
		<p class="text-gray-500">No replacements available</p>
	{/if}
	<button
		class="bg-gray-500 text-white py-1 px-2 rounded mt-2 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-300"
		on:click={ignoreSuggestion}
	>
		Ignore
	</button>
</div>
