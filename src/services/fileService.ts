// src/services/fileService.ts
import { TopicCreateTransaction, TopicMessageSubmitTransaction, PrivateKey } from "@hashgraph/sdk";
import { client } from "../config/config";
import { logger } from "./logger";

// Constant for max bytes per HCS message (for chunking logic). Hedera Consensus messages can carry ~6KB, but we use a safer smaller limit.
const MAX_CHUNK_SIZE = 4096;  // 4 KB per message chunk (as a guideline)

export class FileService {
    /** Store a file (or large text) on Hedera via HCS-1 standard. Returns the topic ID where the file is stored. */
    async storeFile(content: string, ownerAccount: string, ownerKey: string): Promise<string> {
        // 1. Create a new topic to hold the file data (representing an HCS-1 file)
        const tx = new TopicCreateTransaction().setTopicMemo(`HCS-1 File by ${ownerAccount}`);
        const resp = await tx.execute(client);
        const receipt = await resp.getReceipt(client);
        const fileTopicId = receipt.topicId?.toString();
        if (!fileTopicId) {
            throw new Error("Failed to create file topic for HCS-1 storage");
        }
        logger.info(`Created file topic ${fileTopicId} for storing content (size=${content.length} bytes)`);

        // 2. Chunk the content if it exceeds MAX_CHUNK_SIZE
        const chunks: string[] = [];
        for (let i = 0; i < content.length; i += MAX_CHUNK_SIZE) {
            chunks.push(content.substring(i, i + MAX_CHUNK_SIZE));
        }
        // 3. Submit each chunk as a message to the topic
        const ownerPrivKey = PrivateKey.fromString(ownerKey);
        for (let idx = 0; idx < chunks.length; idx++) {
            const chunk = chunks[idx];
            const message = (chunks.length > 1)
                ? `[${idx + 1}/${chunks.length}] ${chunk}`  // simple prefix indicating order
                : chunk;
            await new TopicMessageSubmitTransaction()
                .setTopicId(fileTopicId)
                .setMessage(message)
                .freezeWith(client)
                .sign(ownerPrivKey)
                .execute(client);
            logger.debug(`Submitted chunk ${idx + 1}/${chunks.length} to file topic ${fileTopicId}`);
        }
        logger.info(`Stored content in ${chunks.length} message(s) on topic ${fileTopicId}`);
        return fileTopicId;
    }

    /** Retrieve file content from a given file topic (reassemble chunks). */
    async fetchFile(fileTopicId: string): Promise<string> {
        // Use mirror node to fetch all messages from the file topic
        const url = `https://api.${config.network}.mirrornode.hedera.com/api/v1/topics/${fileTopicId}/messages?order=asc`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch file content from topic");
        const data = await res.json();
        let content = '';
        for (const m of data.messages) {
            let chunk = Buffer.from(m.message, 'base64').toString();
            // Remove chunk prefix if present (e.g., "[1/3] ")
            chunk = chunk.replace(/^\[\d+\/\d+\]\s/, '');
            content += chunk;
        }
        return content;
    }
}

export const fileService = new FileService();
