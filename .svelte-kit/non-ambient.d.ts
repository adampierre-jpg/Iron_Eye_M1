
// this file is generated — do not edit it


declare module "svelte/elements" {
	export interface HTMLAttributes<T> {
		'data-sveltekit-keepfocus'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-noscroll'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-preload-code'?:
			| true
			| ''
			| 'eager'
			| 'viewport'
			| 'hover'
			| 'tap'
			| 'off'
			| undefined
			| null;
		'data-sveltekit-preload-data'?: true | '' | 'hover' | 'tap' | 'off' | undefined | null;
		'data-sveltekit-reload'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-replacestate'?: true | '' | 'off' | undefined | null;
	}
}

export {};


declare module "$app/types" {
	export interface AppTypes {
		RouteId(): "/" | "/live" | "/summary" | "/upload";
		RouteParams(): {
			
		};
		LayoutParams(): {
			"/": Record<string, never>;
			"/live": Record<string, never>;
			"/summary": Record<string, never>;
			"/upload": Record<string, never>
		};
		Pathname(): "/" | "/live" | "/live/" | "/summary" | "/summary/" | "/upload" | "/upload/";
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): "/favicon.svg" | "/models/config.json" | "/models/snatch_cnn_v4.onnx" | "/ort-wasm-simd-threaded.asyncify.mjs" | "/ort-wasm-simd-threaded.asyncify.wasm" | "/ort-wasm-simd-threaded.jsep.mjs" | "/ort-wasm-simd-threaded.jsep.wasm" | "/ort-wasm-simd-threaded.mjs" | "/ort-wasm-simd-threaded.wasm" | "/ort.all.bundle.min.mjs" | "/ort.all.min.mjs" | "/ort.all.mjs" | "/ort.bundle.min.mjs" | "/ort.min.mjs" | "/ort.mjs" | "/ort.node.min.mjs" | "/ort.wasm.bundle.min.mjs" | "/ort.wasm.min.mjs" | "/ort.wasm.mjs" | "/ort.webgl.min.mjs" | "/ort.webgl.mjs" | "/ort.webgpu.bundle.min.mjs" | "/ort.webgpu.min.mjs" | "/ort.webgpu.mjs" | "/robots.txt" | string & {};
	}
}