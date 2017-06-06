import typescript from 'rollup-plugin-typescript2';

export default {
	entry: './src/index.ts',
	plugins: [
		typescript(),
	],
}
