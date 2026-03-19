# OpenClaw Synapse

Synapse is the central connective tissue for OpenClaw gateways. It transforms isolated OpenClaw nodes into a distributed, synchronized swarm capable of full state sharing, cross-node tool execution, and centralized auditing.

## Architecture

Synapse operates on a Hub-and-Spoke model:
- **Synapse Hub (Server):** A centralized Fastify + WebSocket server backed by PostgreSQL. It handles authentication, routing, and strict auditing of all cross-node executions.
- **Synapse Client (Plugin):** An OpenClaw native plugin that establishes an outbound, persistent WebSocket connection to the Hub.

## Features

- **Cross-Node Tool Execution:** Node A can request Node B to execute a tool (e.g., `exec`, `web_search`) and stream the result back in real-time.
- **Dual Verification Security:** Synapse acts as the first layer of authorization (via a central permissions matrix), but the local OpenClaw daemon acts as the final gatekeeper, enforcing its own local `security` mode (allowlists, deny rules).
- **Asynchronous Execution:** Long-running remote tools are handled via asynchronous callbacks. The connection isn't blocked while waiting for a tool to finish.
- **Centralized Audit Trail:** Every remote tool execution request, status, and result is logged immutably in the central PostgreSQL database.
- **Aggressive Keepalives:** Built-in ping/pong keepalives ensure the network is hyper-aware of node topology and offline nodes behind NATs.

## Directory Structure

- `/src`: The Synapse Hub (Server) source code (Fastify, WebSockets, Postgres schema).
- `/plugin`: The `openclaw-plugin-synapse` Client source code.
- `/docs/SPEC.md`: The complete V1 technical specification.

## Setup (Hub)

```bash
# Install dependencies
npm install

# Build
npm run build

# Set up environment
cp .env.example .env
# Edit .env with your DATABASE_URL and JWT_SECRET

# Initialize the Database
psql $DATABASE_URL < src/db/schema.sql

# Run
npm start
```

## Setup (Client Plugin)

```bash
cd plugin
npm install
npm run build
# Configure environment variables for SYNAPSE_HUB_URL and SYNAPSE_NODE_ID
node dist/index.js
```
