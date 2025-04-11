// src/routes/agentRoutes.ts
import express from 'express';
import { agentService } from '../services/agentService';

export const agentRouter = express.Router();

/**
 * @route POST /agents/register
 * @desc Register a new agent (or import an existing agent) on Hedera.
 * @body { name: string, accountId?: string, privateKey?: string, capabilities?: number[], model?: string }
 *       - name: Human-readable agent name.
 *       - accountId, privateKey: (optional) use an existing Hedera account. If not provided, a new account is created.
 *       - capabilities: (optional) list of capability codes as per HCS-11 (e.g., [0,4] for text and code generation).
 *       - model, creator: (optional) additional profile info.
 * @return 200 and agent details { accountId, privateKey, profile } on success.
 */
agentRouter.post('/register', async (req, res) => {
    try {
        const { name, accountId, privateKey, capabilities, model, creator } = req.body;
        if (!name) {
            return res.status(400).json({ error: "Agent name is required" });
        }
        const agent = await agentService.registerAgent(name, { accountId, privateKey, capabilities, model, creator });
        // Return the agent's account ID, and privateKey if it was newly generated (to allow user to note it)
        const responseData: any = {
            accountId: agent.accountId,
            profile: agent.profile
        };
        if (req.body.privateKey === undefined) { // if not provided, we created one
            responseData.privateKey = agent.privateKey;
        }
        return res.status(201).json(responseData);
    } catch (error: any) {
        console.error("Error in /agents/register:", error);
        return res.status(500).json({ error: error.message || "Registration failed" });
    }
});

/**
 * @route GET /agents/:accountId
 * @desc Get the profile of a registered agent by account ID.
 * @return 200 and profile JSON if found, 404 if not.
 */
agentRouter.get('/:accountId', async (req, res) => {
    try {
        const accountId = req.params.accountId;
        const profile = await agentService.getAgentProfile(accountId);
        if (!profile) {
            return res.status(404).json({ error: "Agent profile not found" });
        }
        return res.json(profile);
    } catch (error: any) {
        console.error("Error in GET /agents/:accountId:", error);
        return res.status(500).json({ error: error.message });
    }
});

/**
 * @route GET /agents
 * @desc Search for agents by name or capability.
 * @query name (optional) substring to match in agent name (case-insensitive)
 * @query capability (optional) numeric capability code to filter by
 * @return 200 and array of matching agent profiles (could be empty).
 */
agentRouter.get('/', async (req, res) => {
    try {
        const nameQuery = req.query.name as string | undefined;
        const capQuery = req.query.capability as string | undefined;
        const capNum = capQuery !== undefined ? parseInt(capQuery) : undefined;
        const results = await agentService.findAgents({ name: nameQuery, capability: capNum });
        return res.json(results);
    } catch (error: any) {
        console.error("Error in GET /agents:", error);
        return res.status(500).json({ error: error.message });
    }
});
