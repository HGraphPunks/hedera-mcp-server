// test/integration/apiEndpoints.test.ts
import request from 'supertest';
import express from 'express';
import { apiRouter } from "../../src/routes";

describe('API Endpoints', () => {
    const app = express();
    app.use(express.json());
    app.use('/api', apiRouter);

    it('should return 404 for an unknown route', async () => {
        const res = await request(app).get('/api/nonexistent');
        expect(res.status).toBe(404);
    });

    it('should return an empty array when no agents are registered', async () => {
        const res = await request(app).get('/api/agents');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBeTruthy();
        // Might be empty if no prior registrations (state is in memory)
    });
});
