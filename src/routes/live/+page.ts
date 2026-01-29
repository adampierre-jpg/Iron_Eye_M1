import type { PageLoad } from './$types';

// 1. Disable Server-Side Rendering (SSR)
// The server has no camera, no WebGL, and no business running this page.
export const ssr = false;

// 2. Enable Prerendering (Optional but good for static hosts)
// Since there is no dynamic data needed from the server, we can treat it as static.
export const prerender = false;