import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		// Static adapter for client-only PWA
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: 'index.html', // SPA fallback
			precompress: true,
			strict: true
		}),
		
		// Alias configuration
		alias: {
			'$lib': './src/lib'
		}
	}
};

export default config;
