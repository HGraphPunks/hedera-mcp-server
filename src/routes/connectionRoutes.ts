// src/routes/connectionRoutes.ts
import express from 'express';
import { connectionService } from '../services/connectionService';

export const connectionRouter = express.Router();

/**
 * @route POST /connections/request
 * @desc Initiate a connection request from one agent to another.
 * @body { fromAccount: string, fromPrivateKey: string, toAccount: string }
 * @return 200 and { requestSequenceNumber } if sent.
 */
connectionRouter.post('/request', async (req, res) => {
    try {
        const { fromAccount, fromPrivateKey, toAccount } = req.body;
        if (!fromAccount || !fromPrivateKey || !toAccount) {
            return res.status(400).json({ error: "fromAccount, fromPrivateKey, and toAccount are required" });
        }
        const seqNum = await connectionService.requestConnection(fromAccount, fromPrivateKey, toAccount);
        return res.json({ requestSequenceNumber: seqNum });
    } catch (error: any) {
        console.error("Error in POST /connections/request:", error);
        return res.status(500).json({ error: error.message });
    }
});

/**
 * @route POST /connections/accept
 * @desc Accept a connection request. Creates a connection topic and notifies the requester.
 * @body { fromAccount: string, fromPrivateKey: string, requesterAccount: string }
 * @return 200 and { connectionTopicId } on success.
 */
connectionRouter.post('/accept', async (req, res) => {
    try {
        const { fromAccount, fromPrivateKey, requesterAccount } = req.body;
        if (!fromAccount || !fromPrivateKey || !requesterAccount) {
            return res.status(400).json({ error: "fromAccount, fromPrivateKey, and requesterAccount are required" });
        }
        const topicId = await connectionService.acceptConnection(fromAccount, fromPrivateKey, requesterAccount);
        return res.json({ connectionTopicId: topicId });
    } catch (error: any) {
        console.error("Error in POST /connections/accept:", error);
        return res.status(500).json({ error: error.message });
    }
});

/**
 * @route GET /connections
 * @desc List connections for a given agent.
 * @query accountId (string) - the agent's account ID to list connections for.
 * @return 200 and [{ peer: accountId, connectionTopicId: string }, ...] array.
 */
connectionRouter.get('/', (req, res) => {
    try {
        const accountId = req.query.accountId as string;
        if (!accountId) {
            return res.status(400).json({ error: "accountId query param is required" });
        }
        const list = connectionService.listConnections(accountId);
        return res.json(list);
    } catch (error: any) {
        console.error("Error in GET /connections:", error);
        return res.status(500).json({ error: error.message });
    }
});

/**
 * @route POST /messages/send
 * @desc Send a message from an agent over a connection.
 * @body { senderAccount: string, senderKey: string, connectionTopicId: string, message: string }
 * @return 200 and { sequenceNumber } of the message on the connection topic.
 */
connectionRouter.post('/messages/send', async (req, res) => {
    try {
        const { senderAccount, senderKey, connectionTopicId, message } = req.body;
        if (!senderAccount || !senderKey || !connectionTopicId || message === undefined) {
            return res.status(400).json({ error: "senderAccount, senderKey, connectionTopicId, and message are required" });
        }
        const seq = await connectionService.sendMessage(senderAccount, senderKey, connectionTopicId, message);
        return res.json({ sequenceNumber: seq });
    } catch (error: any) {
        console.error("Error in POST /messages/send:", error);
        return res.status(500).json({ error: error.message });
    }
});

/**
 * @route GET /messages
 * @desc Fetch recent messages from a connection topic.
 * @query connectionTopicId, [limit]
 * @return 200 and { messages: [messageString, ...] }
 */
connectionRouter.get('/messages', async (req, res) => {
    try {
        const topicId = req.query.connectionTopicId as string;
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
        if (!topicId) {
            return res.status(400).json({ error: "connectionTopicId query param is required" });
        }
        const msgs = await connectionService.getMessages(topicId, limit);
        return res.json({ messages: msgs });
    } catch (error: any) {
        console.error("Error in GET /messages:", error);
        return res.status(500).json({ error: error.message });
    }
});
