# Hedera MCP Server (ALPHA - INITIAL FUNCTIONALITY STILL BROKEN)

## Overview

The **Hedera MCP Server** is a production-ready, modular Node.js (TypeScript) server designed to enable decentralized communication between AI agents on the Hedera network. It implements the **Model-Context-Protocol (MCP)** architecture, exposing both a RESTful API and an SSE-based (Server-Sent Events) MCP interface.

Using the [Hedera Agent Kit](https://www.npmjs.com/package/hedera-agent-kit) alongside the [Standards Agent Kit](https://www.npmjs.com/package/@hashgraphonline/standards-agent-kit), the server supports multiple Hedera Consensus Service (HCS) standards:

- **HCS-1 (File/Data Management)**
- **HCS-2 (Registry for Agent Discovery)**
- **HCS-3 (Large Message Handling and Recursion)**
- **HCS-10 (Agent Communication Protocol)**
- **HCS-11 (Decentralized Identity/Profile Management)**

This server is especially aimed at hackathon participants and developers building AI-integrated decentralized applications on Hedera. It is also compatible with tools like [Cursor](https://cursor.so/) for autonomous agent interactions.

---

## Folder Structure

```
hedera-mcp-server/
├── src/
│   ├── config/
│   │   └── config.ts             # Configuration loader (environment variables, Hedera client)
│   ├── services/
│   │   ├── agentService.ts       # Agent registration & profile management (HCS-10/HCS-11)
│   │   ├── connectionService.ts  # Connection request, acceptance & messaging (HCS-10)
│   │   ├── fileService.ts        # File storage for large messages (HCS-1 & HCS-3)
│   │   ├── logger.ts             # Logging utility
│   │   └── profileUtil.ts        # Helper for serializing agent profiles
│   ├── routes/
│   │   ├── agentRoutes.ts        # API endpoints for agent registration & query
│   │   ├── connectionRoutes.ts   # API endpoints for connection and messaging
│   │   └── index.ts              # Route aggregator for the REST API
│   ├── mcp/
│   │   └── mcpServer.ts          # MCP server (SSE interface) definition using FastMCP and Zod
│   └── index.ts                  # Main entry point to initialize Express and MCP servers
├── test/
│   ├── unit/
│   │   ├── agentService.test.ts       # Unit tests for agent logic and profile serialization
│   │   ├── connectionService.test.ts  # Unit tests for connection and message formatting
│   │   └── fileService.test.ts        # Unit tests for file chunking and file storage
│   ├── integration/
│   │   └── apiEndpoints.test.ts       # Integration tests for REST API endpoints
│   └── e2e/
│       └── agentCommunication.e2e.ts  # End-to-end tests simulating agent registration, connection, and messaging
├── Dockerfile                   # Docker configuration for building the server image
├── docker-compose.yml           # One-command deployment configuration for Docker
├── package.json                 # Project metadata and scripts
└── README.md                    # This file
```

---

## Features

- **Agent Registration & Profiles (HCS-11):**  
  Create new Hedera accounts (or import existing ones) for AI agents. Automatically set up inbound/outbound topics and on-chain profiles.
  
- **Agent Discovery (HCS-2):**  
  Register agents in a centralized registry topic. Discover agents by name or capability using the provided search API.

- **Secure Communication (HCS-10):**  
  Initiate and accept connection requests between agents. Establish dedicated connection topics over which agents can securely exchange messages.

- **Large Message Handling (HCS-1 & HCS-3):**  
  Offload large message content by storing it on dedicated file topics and returning an HRL (HCS Resource Locator) reference within messages.

- **MCP Interface via SSE:**  
  Expose an MCP-compliant SSE endpoint (via [FastMCP](https://www.npmjs.com/package/fastmcp)) that lets AI tools like Cursor directly invoke server “tools” (e.g., register_agent, send_message).

- **RESTful API:**  
  Expose comprehensive HTTP endpoints for agent operations, connection management, and messaging, with detailed request/response formats.

- **Production-Ready Deployment:**  
  Comes with Docker and Docker Compose configurations for seamless one-command deployment.

---

## Requirements

- **Node.js** ≥ 18 (LTS recommended)
- **npm** (comes with Node)
- **Docker** and **Docker Compose** (for container deployment)
- A Hedera Testnet (or Mainnet) account with sufficient funds for transactions  
  *(Set the following environment variables: `HEDERA_OPERATOR_ID` and `HEDERA_OPERATOR_KEY`.)*

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/hgraphpunks/hedera-mcp-server.git
cd hedera-mcp-server
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the project root with the following content (adjust with your actual credentials):

```ini
# .env
HEDERA_NETWORK=testnet
HEDERA_OPERATOR_ID=0.0.12345
HEDERA_OPERATOR_KEY=302e0201...
REGISTRY_TOPIC_ID=        # (optional – if not provided, a new registry topic will be created)
PORT=3000
SSE_PORT=3001
```

### 4. Build the Project

Compile the TypeScript code into JavaScript:

```bash
npm run build
```

### 5. Run the Server Locally

Start the REST API and MCP SSE servers:

```bash
npm start
```

You should see logs indicating that:
- The REST API is listening on `http://localhost:3000`
- The MCP SSE server is available at `http://localhost:3001/sse`

### 6. Development Mode

For rapid development with automatic rebuilds, use:

```bash
npm run dev
```

---

## API Documentation

### Agent Endpoints

- **POST /api/agents/register**  
  _Registers a new agent._  
  **Request Body:**
  ```json
  {
    "name": "AliceAgent",
    "accountId": "0.0.ABCDE",         // optional – leave empty to generate a new account
    "privateKey": "302e0201...",       // optional – required if accountId is provided
    "capabilities": [0, 4],
    "model": "gpt-4",
    "creator": "Alice"
  }
  ```
  **Response (201 Created):**
  ```json
  {
    "accountId": "0.0.789123",
    "privateKey": "302e0201... (if new)",
    "profile": {
      "name": "AliceAgent",
      "inboundTopicId": "0.0.444444",
      "outboundTopicId": "0.0.444445",
      "type": 1,
      "capabilities": [0, 4],
      "model": "gpt-4",
      "creator": "Alice"
    }
  }
  ```

- **GET /api/agents/{accountId}**  
  _Retrieves the profile of an agent by account ID._  
  **Response (200 OK):**
  ```json
  {
    "name": "AliceAgent",
    "inboundTopicId": "0.0.444444",
    "outboundTopicId": "0.0.444445",
    "type": 1,
    "capabilities": [0, 4],
    "model": "gpt-4",
    "creator": "Alice"
  }
  ```

- **GET /api/agents?name=Alice&capability=0**  
  _Search for agents by name and/or capability._  
  **Response (200 OK):**
  ```json
  [
    {
      "name": "AliceAgent",
      "inboundTopicId": "0.0.444444",
      "outboundTopicId": "0.0.444445",
      "type": 1,
      "capabilities": [0, 4],
      "model": "gpt-4",
      "creator": "Alice"
    }
  ]
  ```

### Connection Endpoints

- **POST /api/connections/request**  
  _Initiates a connection request to another agent._  
  **Request Body:**
  ```json
  {
    "fromAccount": "0.0.AAAAA",
    "fromPrivateKey": "302e0201...",
    "toAccount": "0.0.BBBBB"
  }
  ```
  **Response (200 OK):**
  ```json
  { "requestSequenceNumber": 42 }
  ```

- **POST /api/connections/accept**  
  _Accepts a connection request and creates a dedicated connection topic._  
  **Request Body:**
  ```json
  {
    "fromAccount": "0.0.BBBBB",
    "fromPrivateKey": "302e0201...",
    "requesterAccount": "0.0.AAAAA"
  }
  ```
  **Response (200 OK):**
  ```json
  { "connectionTopicId": "0.0.CCCCC" }
  ```

- **GET /api/connections?accountId=0.0.AAAAA**  
  _Lists all active connections for a given agent._  
  **Response (200 OK):**
  ```json
  [
    { "peer": "0.0.BBBBB", "connectionTopicId": "0.0.CCCCC" }
  ]
  ```

### Messaging Endpoints

- **POST /api/messages/send**  
  _Sends a message over an established connection._  
  **Request Body:**
  ```json
  {
    "senderAccount": "0.0.AAAAA",
    "senderKey": "302e0201...",
    "connectionTopicId": "0.0.CCCCC",
    "message": "Hello, AgentB!"
  }
  ```
  **Response (200 OK):**
  ```json
  { "sequenceNumber": 7 }
  ```

- **GET /api/messages?connectionTopicId=0.0.CCCCC&limit=10**  
  _Retrieves recent messages from a connection topic._  
  **Response (200 OK):**
  ```json
  {
    "messages": [
      "{\"p\":\"hcs-10\",\"op\":\"message\",\"operator_id\":\"0.0.444444@0.0.AAAAA\",\"data\":\"Hello, AgentB!\",\"m\":\"Message from agent.\"}"
    ]
  }
  ```

---

## MCP SSE Interface

The server exposes an MCP interface over SSE (Server-Sent Events) powered by [FastMCP](https://www.npmjs.com/package/fastmcp). This interface is available at:

```
http://localhost:3001/sse
```

### Integration with Cursor

1. **Run the Server:**  
   Ensure the MCP SSE server is running (default on port 3001). Use `npm start` or Docker as described below.

2. **Configure in Cursor:**  
   In Cursor’s MCP settings, add a new MCP server with the URL:  
   ```
   http://localhost:3001/sse
   ```
   Cursor will automatically retrieve the list of available tools (e.g., `register_agent`, `request_connection`, `send_message`, etc.).

3. **Usage:**  
   You can instruct Cursor’s AI to perform actions using these tools. For example, prompt:  
   > "Register a new agent named AliceAgent and connect me to BobAgent."  
   Cursor will call the respective MCP tools defined in the SSE interface.

---

## Docker Deployment

The project comes with a Dockerfile and a docker-compose.yml file for easy one-command deployment.

### Using Docker Compose

1. **Ensure Environment Variables:**  
   Set your environment variables in a `.env` file in the project root (as shown above).

2. **Build and Run:**

   ```bash
   docker-compose up --build -d
   ```

   This command builds the Docker image and starts the containers in detached mode. The REST API will be accessible on port 3000 and the MCP SSE server on port 3001.

3. **Verify Deployment:**  
   Open your browser or use `curl` to check:

   - Health Check: `http://localhost:3000/`
   - MCP SSE Endpoint: `http://localhost:3001/sse`

---

## Testing

### Running the Test Suite

The project uses [Jest](https://jestjs.io/) for testing. Tests are organized into unit, integration, and end-to-end suites.

Run all tests with:

```bash
npm test
```

Tests include:

- **Unit Tests:** Validate logic in individual services (e.g., file chunking in `fileService.test.ts`).
- **Integration Tests:** Test REST API endpoints using Supertest to ensure proper responses.
- **End-to-End Tests:** Simulate a full agent communication flow (agent registration, connection, and messaging) on Hedera Testnet.

*Note:* Tests will execute live operations on Hedera Testnet. Ensure your test environment has sufficient funds and that you are aware of minimal HBAR consumption.

---

## Maintenance & Optimization

- **Logging & Monitoring:**  
  The server includes a basic logger. In production, consider integrating a more robust logging solution (e.g., Winston or Pino) and setting up log rotation and monitoring dashboards.

- **Caching:**  
  Agent profiles and connection lists are cached in memory. For high-load scenarios, consider replacing these with a persistent store (e.g., Redis or a database).

- **Scaling:**  
  The server is stateless aside from in-memory caches. It can be horizontally scaled behind a load balancer. For multiple instances, ensure they share the same registry configuration so that all agents appear in the global registry.

- **Security Considerations:**  
  - Secure the `.env` file and never expose private keys.
  - For production, implement proper authentication/authorization for API endpoints.
  - Consider using HTTPS and other secure communication practices.

- **Standards Compliance Updates:**  
  Keep an eye on updates to the Hedera Agent Kit and Standards Agent Kit. Upgrading dependencies may require minimal adjustments if new fields or protocols are introduced.

---

## Contributing

Contributions are welcome! Please fork the repository and open pull requests with your improvements. For major changes, please open an issue first to discuss what you would like to change.

---

## License

This project is licensed under the MIT License.

