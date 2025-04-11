// src/services/connectionService.ts
import { TopicCreateTransaction, TopicMessageSubmitTransaction, TopicMessageQuery, PrivateKey } from "@hashgraph/sdk";
import { client } from "../config/config";
import { agentService } from "./agentService";
import { fileService } from "./fileService";
import { logger } from "./logger";

// In-memory record of active connections: maps a connection topic to the two agents (account IDs) involved.
interface ConnectionRecord {
    topicId: string;
    agentA: string;
    agentB: string;
}
const connections: ConnectionRecord[] = [];

export class ConnectionService {
    /** Send a connection request from one agent to another. Returns the sequence # of the request message. */
    async requestConnection(fromAccount: string, fromPrivateKey: string, toAccount: string): Promise<number> {
        logger.info(`Agent ${fromAccount} requesting connection to ${toAccount}`);
        // Get the target's inbound topic from their profile
        const targetProfile = await agentService.getAgentProfile(toAccount);
        if (!targetProfile || !targetProfile.inboundTopicId) {
            throw new Error("Target agent profile not found or has no inbound topic.");
        }
        const inboundTopicId = targetProfile.inboundTopicId;
        // Construct connection_request message (HCS-10 Inbound Topic Operation)&#8203;:contentReference[oaicite:21]{index=21}
        const message = {
            p: "hcs-10",
            op: "connection_request",
            operator_id: `${targetProfile.inboundTopicId}@${fromAccount}`,  // operator_id format inboundTopicId@accountId&#8203;:contentReference[oaicite:22]{index=22}
            m: "Requesting connection."
        };
        const messageStr = JSON.stringify(message);
        // Submit message to target's inbound topic
        const submitTx = new TopicMessageSubmitTransaction()
            .setTopicId(inboundTopicId)
            .setMessage(messageStr);
        // Sign with requestor's key (they should have permission if topic has no submitKey or uses HIP-991 fee).
        const pk = PrivateKey.fromString(fromPrivateKey);
        const resp = await submitTx.freezeWith(client).sign(pk).execute(client);
        const receipt = await resp.getReceipt(client);
        const seqNum = receipt.sequenceNumber;
        logger.info(`Connection request sent from ${fromAccount} to ${toAccount} on topic ${inboundTopicId}, seq # ${seqNum}`);
        return seqNum;
    }

    /** Accept a connection request. Creates a new connection topic and notifies the requester. */
    async acceptConnection(fromAccount: string, fromPrivateKey: string, requesterAccount: string): Promise<string> {
        logger.info(`Agent ${fromAccount} accepting connection request from ${requesterAccount}`);
        // 1. Create a new HCS topic for the direct connection (this will be the "connection topic")
        const tx = new TopicCreateTransaction().setTopicMemo(`Connection ${fromAccount}<->${requesterAccount}`);
        // Optionally, could set access control (e.g., no submit key to allow both parties, or a threshold key requiring both signatures).
        const createResp = await tx.execute(client);
        const createReceipt = await createResp.getReceipt(client);
        const connectionTopicId = createReceipt.topicId?.toString();
        if (!connectionTopicId) {
            throw new Error("Failed to create connection topic");
        }
        logger.info(`Created connection topic ${connectionTopicId} for agents ${fromAccount} and ${requesterAccount}`);

        // 2. Send a connection_created message to the requester's inbound topic (so they know the connection is established)
        const requesterProfile = await agentService.getAgentProfile(requesterAccount);
        if (!requesterProfile || !requesterProfile.inboundTopicId) {
            throw new Error("Requester profile not found or no inbound topic");
        }
        const requesterInbound = requesterProfile.inboundTopicId;
        const message = {
            p: "hcs-10",
            op: "connection_created",
            connection_topic_id: connectionTopicId,
            connected_account_id: fromAccount,
            operator_id: `${requesterProfile.inboundTopicId}@${fromAccount}`,  // format: inboundTopicId@acceptorAccount
            m: "Connection established."
        };
        const messageStr = JSON.stringify(message);
        const submitTx = new TopicMessageSubmitTransaction()
            .setTopicId(requesterInbound)
            .setMessage(messageStr);
        const pk = PrivateKey.fromString(fromPrivateKey);
        await submitTx.freezeWith(client).sign(pk).execute(client);
        logger.info(`Notified ${requesterAccount} of connection on topic ${connectionTopicId}`);

        // 3. (Optional) Log the new connection on the acceptor's outbound topic for record-keeping (HCS-10 suggests recording connections on outbound)&#8203;:contentReference[oaicite:23]{index=23}.
        const acceptorProfile = await agentService.getAgentProfile(fromAccount);
        if (acceptorProfile && acceptorProfile.outboundTopicId) {
            const logMessage = {
                p: "hcs-10",
                op: "connection_created",
                connection_topic_id: connectionTopicId,
                outbound_topic_id: acceptorProfile.outboundTopicId,
                requestor_outbound_topic_id: requesterProfile.outboundTopicId || null,
                m: `Connected with agent ${requesterAccount}`
            };
            try {
                await new TopicMessageSubmitTransaction()
                    .setTopicId(acceptorProfile.outboundTopicId)
                    .setMessage(JSON.stringify(logMessage))
                    .freezeWith(client).sign(PrivateKey.fromString(fromPrivateKey)).execute(client);
                logger.info(`Logged connection on outbound topic ${acceptorProfile.outboundTopicId} for agent ${fromAccount}`);
            } catch (err) {
                logger.warn("Failed to log connection on outbound topic", err);
            }
        }

        // 4. Store the connection in memory for quick reference
        connections.push({ topicId: connectionTopicId, agentA: requesterAccount, agentB: fromAccount });
        return connectionTopicId;
    }

    /** List active connections for a given agent (by account ID). */
    listConnections(accountId: string): { peer: string, connectionTopicId: string }[] {
        return connections
            .filter(conn => conn.agentA === accountId || conn.agentB === accountId)
            .map(conn => {
                const peer = conn.agentA === accountId ? conn.agentB : conn.agentA;
                return { peer, connectionTopicId: conn.topicId };
            });
    }

    /** Send a message from one agent to another (must have an established connection topic). */
    async sendMessage(senderAccount: string, senderKey: string, connectionTopicId: string, message: string): Promise<number> {
        // 1. Check if this sender is part of the specified connection
        const conn = connections.find(c => c.topicId === connectionTopicId && (c.agentA === senderAccount || c.agentB === senderAccount));
        if (!conn) {
            throw new Error("Connection not found or sender not a participant");
        }
        // 2. Handle large message via HCS-1 if needed
        let dataField = message;
        if (Buffer.byteLength(message, 'utf8') > 1000) {
            // If message is >1KB, store it as an HCS-1 file and get an HRL reference&#8203;:contentReference[oaicite:24]{index=24}.
            const fileTopicId = await fileService.storeFile(message, senderAccount, senderKey);
            dataField = `hcs://1/${fileTopicId}`;  // HCS-1 HRL format reference
            logger.info(`Message content stored in topic ${fileTopicId}, using HRL reference in main message`);
        }
        // 3. Construct message payload as per HCS-10 connection message operation
        const payload = {
            p: "hcs-10",
            op: "message",
            operator_id: `${connnections.find(c => c.topicId === connectionTopicId)?.agentB === senderAccount
                ? agentService.getAgentProfile(conn.agentA)?.inboundTopicId
                : agentService.getAgentProfile(conn.agentB)?.inboundTopicId}@${senderAccount}`,
            data: dataField,
            m: "Message from agent."
        };
        // The operator_id is formatted as "inboundTopicId@senderAccountId"&#8203;:contentReference[oaicite:25]{index=25}. Here we find the sender's inboundTopicId via the peer's record (or store inbound in connection record for easier access).
        // (For simplicity, above we attempted to derive operator_id; in practice, each agent knows its own inbound ID. We might store inbound of each agent in connections too.)
        const senderProfile = await agentService.getAgentProfile(senderAccount);
        const operatorIdField = senderProfile?.inboundTopicId ? `${senderProfile.inboundTopicId}@${senderAccount}` : `${senderAccount}`;
        payload.operator_id = operatorIdField;
        const payloadStr = JSON.stringify(payload);
        // 4. Submit to the connection topic
        const submitTx = new TopicMessageSubmitTransaction()
            .setTopicId(connectionTopicId)
            .setMessage(payloadStr);
        const pk = PrivateKey.fromString(senderKey);
        const resp = await submitTx.freezeWith(client).sign(pk).execute(client);
        const receipt = await resp.getReceipt(client);
        const seq = receipt.sequenceNumber;
        logger.info(`Agent ${senderAccount} sent message on connection ${connectionTopicId} (seq #${seq})`);
        return seq;
    }

    /** Retrieve recent messages from a connection topic (for demo purposes, using mirror query). */
    async getMessages(connectionTopicId: string, limit = 10): Promise<string[]> {
        // Use mirror node API to fetch messages on the topic (most recent 'limit' messages)
        const url = `https://api.${config.network}.mirrornode.hedera.com/api/v1/topics/${connectionTopicId}/messages?limit=${limit}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch messages from connection topic");
        const data = await res.json();
        const messages: string[] = [];
        for (const m of data.messages || []) {
            const text = Buffer.from(m.message, 'base64').toString();
            messages.push(text);
        }
        return messages;
    }
}

export const connectionService = new ConnectionService();
