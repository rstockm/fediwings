import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig, type Plugin } from 'vite';

/**
 * Injects a strict Content-Security-Policy meta tag.
 * - Production: only same-origin scripts/styles, HTTPS for images and API calls.
 * - Development: additionally allows inline styles and WebSocket HMR endpoints.
 */
function cspPlugin(): Plugin {
  return {
    name: 'content-security-policy',
    transformIndexHtml(html, ctx) {
      const dev = Boolean(ctx.server);
      const styleSrc = dev ? "'self' 'unsafe-inline'" : "'self'";
      const connectSrc = dev ? "'self' https: ws://127.0.0.1:* ws://localhost:*" : "'self' https:";
      const policy = [
        "default-src 'none'",
        "script-src 'self'",
        `style-src ${styleSrc}`,
        "img-src 'self' https: data:",
        `connect-src ${connectSrc}`,
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'none'",
      ].join('; ');

      return {
        html,
        tags: [
          {
            tag: 'meta',
            attrs: { 'http-equiv': 'Content-Security-Policy', content: policy },
            injectTo: 'head-prepend',
          },
        ],
      };
    },
  };
}

export default defineConfig({
  base: process.env.GITHUB_ACTIONS
    ? `/${process.env.GITHUB_REPOSITORY?.split('/')[1] ?? ''}/`
    : '/',
  plugins: [svelte(), cspPlugin()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test-setup.ts'],
  },
});
