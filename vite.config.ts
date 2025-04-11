import { defineConfig } from 'vite';
import { VitePluginNode } from 'vite-plugin-node';

export default defineConfig({
    server: {
        // Configure server port if needed, e.g., port: 3000
        // proxy: {} // Configure proxy if needed
    },
    plugins: [
        ...VitePluginNode({
            // Tell Vite Novde plugin your Node.js app format (cjs or esm)
            adapter: 'express', // Example: 'express', 'fastify', 'koa', 'nest' etc. Adjust as needed.

            // Tell the plugin where is your project entry
            appPath: './src/index.ts',

            // Optional, default: 'viteNodeApp'
            // the name of named export of you app from the appPath file
            exportName: 'viteNodeApp',

            // Optional, default: 'esbuild'
            // The TypeScript compiler you want to use
            // by default this plugin uses esbuild.
            // 'swc' is supported to use swc Packet for compilation
            // You need to install `@swc/core` as dev dependency if you want to use swc
            tsCompiler: 'esbuild',

            // Optional, default: {
            // jsc: {
            //   target: 'es2019',
            //   parser: {
            //     syntax: 'typescript',
            //     decorators: true
            //   },
            //  transform: {
            //     legacyDecorator: true,
            //     decoratorMetadata: true
            //   }
            // }
            // }
            // swc configs, see https://swc.rs/docs/configuration/swcrc
            // swcOptions: {}
        })
    ],
    optimizeDeps: {
        // If you use packages that don't work well with Vite's pre-bundling,
        // disable them here (optional)
        // exclude: ['my-problematic-package'],
    },
    build: {
        // Configure build options if needed
        // outDir: 'dist',
        // target: 'es2020', // Or your desired target environment
        // lib: { // If building a library
        //   entry: './src/index.ts',
        //   name: 'MyLibrary',
        //   fileName: (format) => `my-library.${format}.js`
        // },
        // rollupOptions: { // Advanced Rollup options
        //   // ...
        // }
    }
}); 