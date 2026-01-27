import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	
	// Optimize for client-only app
	optimizeDeps: {
		// MediaPipe is loaded from CDN at runtime
		exclude: ['@mediapipe/pose', '@mediapipe/holistic']
	},
	
	// Build optimizations
	build: {
		// Target modern browsers for better performance
		target: 'esnext',
		// Enable minification
		minify: 'esbuild'
	},
	
	// Dev server settings
	server: {
		// HTTPS for camera access in dev
		// Will be enabled if certs exist
		// https: true
	}
});
