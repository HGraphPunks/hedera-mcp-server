// src/mcp/mcpServer.ts
import { FastMCP } from 'fastmcp';
import { z } from 'zod';
import { agentService } from '../services/agentService';
import { connectionService } from '../services/connectionService';

// Initialize FastMCP server with basic metadata
const MCP_SERVER_NAME = "Hedera MCP Server";
const MCP_SERVER_VERSION = "1.0.0";
export const mcpServer = new FastMCP({ name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION });

/** Define MCP Tools corresponding to our API operations **/

// Tool: Register a new agent
mcpServer.addTool({
    name: "register_agent",
    description: "Create and register a new AI agent on Hedera (HCS-10/HCS-11). If no account is provided, generates a new one.",
    parameters: z.object({
        name: z.string(),
        accountId: z.string().optional(),
        privateKey: z.string().optional(),
        capabilities: z.array(z.number()).optional(),
        model: z.string().optional(),
        creator: z.string().optional()
    }),
    execute: async (args) => {
        const { name, accountId, privateKey, capabilities, model, creator } = args;
        const agent = await agentService.registerAgent(name, { accountId, privateKey, capabilities, model, creator });
        // Return a short summary to the caller
        return JSON.stringify({
            accountId: agent.accountId,
            // Only return privateKey if it was newly created
            privateKey: args.privateKey ? undefined : agent.privateKey,
            profile: agent.profile
        });
    }
});

// Tool: Find agents by name or capability
mcpServer.addTool({
    name: "find_agents",
    description: "Search for registered agents by name or capability.",
    parameters: z.object({
        name: z.string().optional(),
        capability: z.number().optional()
    }),
    execute: async (args) => {
        const results = await agentService.findAgents({ name: args.name, capability: args.capability });
        return JSON.stringify(results);
    }
});

// Tool: Initiate connection
mcpServer.addTool({
    name: "request_connection",
    description: "Request a communication connection with another agent.",
    parameters: z.object({
        fromAccount: z.string(),
        fromPrivateKey: z.string(),
        toAccount: z.string()
    }),
    execute: async (args) => {
        const seq = await connectionService.requestConnection(args.fromAccount, args.fromPrivateKey, args.toAccount);
        return `Connection request sent (sequence # ${seq}).`;
    }
});

// Tool: Accept connection
mcpServer.addTool({
    name: "accept_connection",
    description: "Accept a pending connection request from another agent.",
    parameters: z.object({
        fromAccount: z.string(),
        fromPrivateKey: z.string(),
        requesterAccount: z.string()
    }),
    execute: async (args) => {
        const topicId = await connectionService.acceptConnection(args.fromAccount, args.fromPrivateKey, args.requesterAccount);
        return `Connection established (topic ${topicId}).`;
    }
});

// Tool: List connections
mcpServer.addTool({
    name: "list_connections",
    description: "List active connections for an agent.",
    parameters: z.object({
        accountId: z.string()
    }),
    execute: async (args) => {
        const conns = connectionService.listConnections(args.accountId);
        return JSON.stringify(conns);
    }
});

// Tool: Send message
mcpServer.addTool({
    name: "send_message",
    description: "Send a message over an established connection.",
    parameters: z.object({
        senderAccount: z.string(),
        senderKey: z.string(),
        connectionTopicId: z.string(),
        message: z.string()
    }),
    execute: async (args) => {
        const seq = await connectionService.sendMessage(args.senderAccount, args.senderKey, args.connectionTopicId, args.message);
        return `Message sent (sequence # ${seq}).`;
    }
});

// Tool: Fetch messages
mcpServer.addTool({
    name: "get_messages",
    description: "Fetch recent messages from a connection.",
    parameters: z.object({
        connectionTopicId: z.string(),
        limit: z.number().optional()
    }),
    execute: async (args) => {
        const msgs = await connectionService.getMessages(args.connectionTopicId, args.limit ?? 10);
        return JSON.stringify(msgs);
    }
});
