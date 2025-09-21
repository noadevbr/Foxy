import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/**/*.ts'],
	format: 'esm',
	target: 'ES2022',
	outDir: './dist',
	clean: false,
	keepNames: false,
	splitting: false, // 👈 Desativa geração de chunks
	sourcemap: false,
	minify: false,
	dts: false,
});
