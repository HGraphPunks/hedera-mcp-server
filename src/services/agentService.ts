// src/services/agentService.ts
import { PrivateKey, AccountCreateTransaction, Hbar, TopicCreateTransaction, AccountUpdateTransaction } from '@hashgraph/sdk';
import { HCS10Client, StandardNetworkType } from '@hashgraphonline/standards-agent-kit';
import { HederaAgentKit } from 'hedera-agent-kit';
import { client, config } from '../config/config';
import { logger } from './logger';
import { profileToMemo } from './profileUtil';  // (a helper to format profile JSON, shown below)

// Data structure to keep track of created agent credentials in-memory (for demo/testing)
interface AgentRecord {
    accountId: string;
    privateKey: string;
    profile: AgentProfile;
}
interface AgentProfile {
    name: string;
    inboundTopicId: string;
    outboundTopicId: string;
    // Additional profile fields (type, capabilities, etc. from HCS-11) can be included
    type: number;              // 1 for AI agent (per HCS-11 enum)
    capabilities: number[];    // list of capability codes (e.g., [0,4] for text generation and code generation)
    model?: string;
    creator?: string;
}
const agents: Record<string, AgentRecord> = {};  // in-memory registry of agent info (accountId as key)

export class AgentService {
    /** Create a new agent Hedera account (if key not provided), set up profile (HCS-11), and register in registry (HCS-2). */
    async registerAgent(name: string, opts?: { accountId?: string, privateKey?: string, capabilities?: number[], model?: string, creator?: string }): Promise<AgentRecord> {
        logger.info(`Registering agent "${name}"...`);
        let accountId = opts?.accountId;
        let privateKeyHex = opts?.privateKey;
        let newKey: PrivateKey | null = null;

        // 1. Create a Hedera account for the agent if not provided
        if (!accountId || !privateKeyHex) {
            newKey = PrivateKey.generateED25519();  // generate a new Ed25519 key
            const pubKey = newKey.publicKey;
            const createTx = new AccountCreateTransaction()
                .setKey(pubKey)
                .setInitialBalance(new Hbar(10));  // initial funding for new account (10 HBAR for example)
            const response = await createTx.execute(client);
            const receipt = await response.getReceipt(client);
            accountId = receipt.accountId?.toString();
            privateKeyHex = newKey.toString();
            if (!accountId) {
                throw new Error('Failed to create new Hedera account for agent');
            }
            logger.info(`Created new Hedera account ${accountId} for agent ${name}`);
        } else {
            // If an existing account was provided, ensure keys are in correct format
            try {
                PrivateKey.fromString(privateKeyHex); // validate key
            } catch {
                throw new Error('Invalid private key format provided');
            }
            logger.info(`Using existing account ${accountId} for agent ${name}`);
        }

        // 2. Initialize an HCS10 client for this agent (for topic management & registry operations)
        const operatorId = accountId;
        const operatorKey = PrivateKey.fromString(privateKeyHex);
        const network = config.network as StandardNetworkType;
        const hcsClient = new HCS10Client(operatorId, operatorKey, network);
        // HCS10Client will be used for actions like creating topics and sending messages according to HCS-10 standard&#8203;:contentReference[oaicite:11]{index=11}.

        // 3. Create inbound and outbound topics for the agent (if not existing)
        // The HCS10Client can handle creating these required topics.
        const { inboundTopicId, outboundTopicId } = await hcsClient.createAgentTopics();
        // The Standards Agent Kit ensures these topics are created with proper configurations (public visibility etc.) as per HCS-10.

        logger.info(`Created inbound topic ${inboundTopicId} and outbound topic ${outboundTopicId} for agent ${name}`);

        // 4. Build the agent's profile (HCS-11) and set as the account memo.
        const profile: AgentProfile = {
            name,
            inboundTopicId,
            outboundTopicId,
            type: 1,  // AI agent profile (HCS-11 ProfileTypes: 1 represents AI agent&#8203;:contentReference[oaicite:12]{index=12})
            capabilities: opts?.capabilities || [],
            model: opts?.model || undefined,
            creator: opts?.creator || undefined
        };
        const memo = profileToMemo(profile);
        // Use Hedera SDK (or AgentKit) to set the account memo.
        await new AccountUpdateTransaction()
            .setAccountId(accountId!)
            .setAccountMemo(memo)
            .freezeWith(client)
            .sign(PrivateKey.fromString(privateKeyHex!))
            .execute(client);
        logger.info(`Profile set in account memo for ${accountId}: ${memo}`);

        // 5. Register the agent in the registry topic (HCS-2) so other agents can discover it.
        // The HCS-10 standard defines a register operation to add the accountId to the registry&#8203;:contentReference[oaicite:13]{index=13}.
        const registryId = config.registryTopicId || await this.ensureRegistryTopic();
        const registerMessage = {
            p: "hcs-10",
            op: "register",
            account_id: accountId,
            m: `Registering AI agent "${name}".`
        };
        // Use the operator HCS client to submit the registry message. If HIP-991 (paid registration) is needed, HCS10Client handles it.
        await hcsClient.registerAgent(registryId, registerMessage);
        logger.info(`Agent ${accountId} registered on registry topic ${registryId}`);

        // 6. Store agent info in memory (for quick lookup in this server instance)
        const agentRecord: AgentRecord = { accountId: accountId!, privateKey: privateKeyHex!, profile };
        agents[accountId!] = agentRecord;
        return agentRecord;
    }

    /** Helper to ensure a registry topic exists. Creates one if not configured. Returns the topic ID string. */
    private async ensureRegistryTopic(): Promise<string> {
        if (config.registryTopicId) {
            return config.registryTopicId;
        }
        logger.info("No registry topic specified. Creating a new registry topic (HCS-2)...");
        const tx = new TopicCreateTransaction()
            .setTopicMemo("HCS-2 Agent Registry")  // simple memo
            .setSubmitKey(config.operatorKey.publicKey);  // optional: require server (operator) signature to submit (for guard)
        const resp = await tx.execute(client);
        const receipt = await resp.getReceipt(client);
        const newTopicId = receipt.topicId?.toString();
        if (!newTopicId) throw new Error("Failed to create registry topic");
        config.registryTopicId = newTopicId;
        logger.info(`Created new registry topic: ${newTopicId}`);
        return newTopicId;
    }

    /** Retrieve an agent's profile information by account ID (fetches from mirror node if not in memory). */
    async getAgentProfile(accountId: string): Promise<AgentProfile | null> {
        // If the agent was created during this runtime, use cached profile
        if (agents[accountId]) {
            return agents[accountId].profile;
        }
        // Otherwise, fetch from Hedera network (mirror node) via account info
        try {
            const info = await client.getAccountInfo(accountId);
            const memo = info.accountMemo;
            return memo ? JSON.parse(memo) as AgentProfile : null;
        } catch (err) {
            logger.error(`Error fetching profile for ${accountId}`, err);
            return null;
        }
    }

    /** Find agents by name or capability. This scans the registry and filters profiles. */
    async findAgents(filter: { name?: string, capability?: number }): Promise<AgentProfile[]> {
        // Fetch all registered agents from the registry topic via mirror node
        const registryId = config.registryTopicId;
        if (!registryId) throw new Error("No registry topic available to search");
        // Use Hedera Mirror Node REST API to get messages from the registry topic
        const url = `https://api.${config.network}.mirrornode.hedera.com/api/v1/topics/${registryId}/messages`;
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`Failed to fetch registry messages: ${res.status}`);
        }
        const data = await res.json();
        const messages = data.messages || [];
        const results: AgentProfile[] = [];
        for (const msg of messages) {
            try {
                const base64msg = msg.message;
                const jsonStr = Buffer.from(base64msg, 'base64').toString();
                const entry = JSON.parse(jsonStr);
                if (entry.op === 'register' && entry.account_id) {
                    const profile = await this.getAgentProfile(entry.account_id);
                    if (!profile) continue;
                    // apply filters
                    if (filter.name && !profile.name.toLowerCase().includes(filter.name.toLowerCase())) {
                        continue;
                    }
                    if (filter.capability !== undefined && !profile.capabilities.includes(filter.capability)) {
                        continue;
                    }
                    results.push(profile);
                }
            } catch (err) {
                logger.warn("Failed to parse a registry message", err);
            }
        }
        return results;
    }
}

export const agentService = new AgentService();
