import { defineConfig } from 'tsup';

export default defineConfig([
	{
		entry: ['src/lib/index.ts'],
		outDir: 'dist',
		format: ['esm', 'cjs'],
		dts: true,
		clean: true,
		bundle: true
	},
	{
		entry: ['src/lib/suggestion.css'],
		outDir: 'dist'
	}
]);
