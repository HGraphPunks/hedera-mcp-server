// src/routes/index.ts
import express from 'express';
import { agentRouter } from './agentRoutes';
import { connectionRouter } from './connectionRoutes';

export const apiRouter = express.Router();

// Mount sub-routers under appropriate path prefixes
apiRouter.use('/agents', agentRouter);
apiRouter.use('/connections', connectionRouter);
// We include messages routes under connections for organizational purposes
apiRouter.use('/', connectionRouter);
// (Alternatively, messages could be in their own router, but here we reuse connectionRouter which also handles /messages routes)
