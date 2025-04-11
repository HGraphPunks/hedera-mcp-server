// src/config/config.ts
import * as dotenv from 'dotenv';
import { Client, AccountId, PrivateKey } from '@hashgraph/sdk';

// Load .env file if present
dotenv.config();

export type NetworkType = 'mainnet' | 'testnet' | 'previewnet';
interface AppConfig {
    network: NetworkType;
    operatorId: AccountId;
    operatorKey: PrivateKey;
    registryTopicId?: string;
    port: number;
    ssePort: number;
}

// Read environment variables (with defaults and validation)
const network = (process.env.HEDERA_NETWORK || 'testnet') as NetworkType;
if (!['mainnet', 'testnet', 'previewnet'].includes(network)) {
    throw new Error(`Unsupported HEDERA_NETWORK: ${network}`);
}
const operatorIdStr = process.env.HEDERA_OPERATOR_ID;
const operatorKeyStr = process.env.HEDERA_OPERATOR_KEY;
if (!operatorIdStr || !operatorKeyStr) {
    throw new Error('HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY must be provided in env');
}
const operatorId = AccountId.fromString(operatorIdStr);
const operatorKey = PrivateKey.fromString(operatorKeyStr);
const registryTopicId = process.env.REGISTRY_TOPIC_ID;  // may be undefined
const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const ssePort = process.env.SSE_PORT ? parseInt(process.env.SSE_PORT) : 3001;

// Initialize Hedera network client for performing operations (for account creation, etc.)
let hederaClient: Client;
switch (network) {
    case 'mainnet':
        hederaClient = Client.forMainnet();
        break;
    case 'previewnet':
        hederaClient = Client.forPreviewnet();
        break;
    default:
        hederaClient = Client.forTestnet();
}
hederaClient.setOperator(operatorId, operatorKey);

// Export configuration and Hedera client
export const config: AppConfig = {
    network,
    operatorId,
    operatorKey,
    registryTopicId,
    port,
    ssePort
};
export const client = hederaClient;
