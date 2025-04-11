// src/index.ts
import express from 'express';
import http from 'http';
import cors from 'cors';
import { config } from './config/config';
import { apiRouter } from './routes';
import { mcpServer } from './mcp/mcpServer';
import { logger } from './services/logger';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());             // enable CORS for all routes (handy for local testing or integration)
app.use(express.json());     // parse JSON request bodies

// Mount API routes under /api for clarity
app.use('/api', apiRouter);

// Basic health check endpoint
app.get('/', (req, res) => {
    res.send(`Hedera MCP Server is running. Network: ${config.network}`);
});

// Start the REST API server
const port = config.port;
server.listen(port, () => {
    logger.info(`REST API listening on http://localhost:${port}`);
});

// Start the MCP SSE server on a separate port
const ssePort = config.ssePort;
mcpServer.start({
    transportType: 'sse',
    sse: { endpoint: '/sse', port: ssePort }
}).then((startedServer) => {
    logger.info(`MCP SSE server started on http://localhost:${ssePort}/sse`);

    // Attach error handler to the started server/transport instance
    if (startedServer && typeof startedServer.on === 'function') {
        startedServer.on('error', (error) => {
            logger.error('MCP Transport/Session Error:', error);
            // Handle specific errors or attempt recovery if needed
        });
        startedServer.on('close', () => {
            logger.warn('MCP Transport/Session Closed');
            // Handle closure if needed
        });
    } else {
        logger.warn('Could not attach error/close listeners to the started MCP server object.');
    }

}).catch(err => {
    logger.error("Failed to start MCP SSE server", err);
});

// Add error handling for operational MCP server errors
// @ts-ignore // Suppress type error, assuming 'error' event might exist but isn't typed
mcpServer.on('error', (error) => {
    // Check if it's the specific connection closed error we want to potentially ignore or handle gracefully
    if (error && typeof error === 'object' && 'code' in error && error.code === -32000) {
        logger.warn('MCP connection closed (Code -32000). This might be expected if no client connects promptly.', { error });
    } else {
        logger.error('Unhandled MCP Server Error:', error);
        // Decide if other errors should crash the server or be handled differently
        // For example, you might re-throw or process.exit(1) for critical errors
    }
});

// Export the app for Vite
export const viteNodeApp = app;
