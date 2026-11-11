import { defineConfig, type Plugin } from 'vite';

/** Preloads the two fonts the first screen needs, so text renders in the final typeface without a late swap. */
function preloadFonts(): Plugin {
  return {
    name: 'preload-critical-fonts',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const files = Object.keys(ctx.bundle ?? {}).filter((name) =>
          /(dm-sans|unbounded)-latin-wght-normal.*\.woff2$/.test(name),
        );
        const links = files
          .map((file) => `<link rel="preload" as="font" type="font/woff2" crossorigin href="/${file}" />`)
          .join('');
        return html.replace('</head>', `${links}</head>`);
      },
    },
  };
}

export default defineConfig({
  plugins: [preloadFonts()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2022',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      // Libraries ship "use client" markers for React Server Components; they are meaningless in a plain SPA bundle.
      onwarn(warning, defaultHandler) {
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return;
        defaultHandler(warning);
      },
      output: {
        // Stable vendor chunks cache well across releases; Cytoscape is only reachable through a dynamic import,
        // so it stays out of the entry bundle and loads when the Map screen opens.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('cytoscape')) return 'vendor-cytoscape';
          if (id.includes('react-router') || id.includes('@remix-run')) return 'vendor-router';
          if (id.includes('@tanstack')) return 'vendor-query';
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) return 'vendor-react';
          return undefined;
        },
      },
    },
  },
});
