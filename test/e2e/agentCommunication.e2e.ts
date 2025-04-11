// test/e2e/agentCommunication.e2e.ts
import request from 'supertest';
import express from 'express';
import { apiRouter } from "../../src/routes";

describe('End-to-End Agent Communication', () => {
    const app = express();
    app.use(express.json());
    app.use('/api', apiRouter);

    let agentA: any;
    let agentB: any;
    let connectionTopicId: string;

    jest.setTimeout(30000); // extend timeout for network operations

    it('should register Agent A', async () => {
        const res = await request(app)
            .post("/api/agents/register")
            .send({ name: "AgentA" });
        expect(res.status).toBe(201);
        agentA = res.body;
        expect(agentA.accountId).toMatch(/^0\.0\./);
        expect(agentA.privateKey).toBeTruthy();
    });

    it('should register Agent B', async () => {
        const res = await request(app)
            .post("/api/agents/register")
            .send({ name: "AgentB" });
        expect(res.status).toBe(201);
        agentB = res.body;
        expect(agentB.accountId).toMatch(/^0\.0\./);
    });

    it('should request a connection from Agent A to Agent B', async () => {
        const res = await request(app)
            .post("/api/connections/request")
            .send({
                fromAccount: agentA.accountId,
                fromPrivateKey: agentA.privateKey,
                toAccount: agentB.accountId
            });
        expect(res.status).toBe(200);
        expect(res.body.requestSequenceNumber).toBeDefined();
    });

    it('should accept the connection request by Agent B', async () => {
        const res = await request(app)
            .post("/api/connections/accept")
            .send({
                fromAccount: agentB.accountId,
                fromPrivateKey: agentB.privateKey,
                requesterAccount: agentA.accountId
            });
        expect(res.status).toBe(200);
        connectionTopicId = res.body.connectionTopicId;
        expect(connectionTopicId).toMatch(/^0\.0\./);
    });

    it('should send a message from Agent A to Agent B', async () => {
        const messageText = "Hello AgentB, this is AgentA.";
        const res = await request(app)
            .post("/api/messages/send")
            .send({
                senderAccount: agentA.accountId,
                senderKey: agentA.privateKey,
                connectionTopicId,
                message: messageText
            });
        expect(res.status).toBe(200);
        expect(res.body.sequenceNumber).toBeGreaterThan(0);
    });

    it('should fetch messages from the connection', async () => {
        const res = await request(app)
            .get(`/api/messages?connectionTopicId=${connectionTopicId}&limit=10`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.messages)).toBeTruthy();
    });
});
