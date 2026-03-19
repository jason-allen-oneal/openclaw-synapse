# Synapse: OpenClaw Gateway Relay Hub

## 1. Overview
Synapse is the central connective tissue for OpenClaw gateways. It transforms isolated OpenClaw nodes into a distributed, synchronized swarm capable of full state sharing, cross-node tool execution, and centralized auditing.

## 2. Core Architecture
- **Topology:** Centralized Hub (Star Topology). All OpenClaw gateways (nodes) connect to Synapse.
- **Primary Protocol:** WebSockets (WSS). Used for real-time, synchronous RPC, such as remote tool execution and streaming outputs.
- **Secondary Protocol:** MQTT. Used for asynchronous broadcasts, pub/sub memory synchronization, and state announcements.
- **Database:** PostgreSQL. Provides strict ACID compliance for audit trails, JSONB for flexible payload storage, and robust connection handling.

## 3. Key Features
- **Cross-Node Tool Execution:** Node A can request Node B to execute a tool (e.g., `exec`, `web_search`) and stream the result back in real-time.
- **Memory Synchronization:** Nodes can broadcast state changes or newly acquired context to the swarm via MQTT topics managed by Synapse.
- **Strict Authorization:** Granular, node-to-node permission matrices defining exactly which tools a node is allowed to execute on another.
- **Centralized Audit Trail:** Every remote tool execution request, status, and result is logged in the central database.
- **Cryptographic Authentication:** Nodes authenticate using asymmetric cryptography (ECDSA) or Long-Lived JWTs + PSK, ensuring zero shared secrets on the wire after initial provisioning.

## 4. Database Schema (PostgreSQL)

### 4.1. `nodes`
Stores the identity and state of connected OpenClaw gateways.
- `id` (UUID, Primary Key)
- `name` (String, Unique) - e.g., "ghostpi-main"
- `public_key` (Text) - For signature verification
- `status` (Enum: online, offline)
- `last_seen` (Timestamp)
- `capabilities` (JSONB) - List of supported tools

### 4.2. `permissions`
The authorization matrix governing cross-node actions.
- `id` (UUID, Primary Key)
- `source_node_id` (UUID, Foreign Key) - The node making the request
- `target_node_id` (UUID, Foreign Key) - The node executing the request
- `allowed_tools` (JSONB) - Array of tool names (e.g., `["read", "web_search"]`)

### 4.3. `executions`
The immutable audit log of all remote tool calls.
- `id` (UUID, Primary Key)
- `source_node_id` (UUID, Foreign Key)
- `target_node_id` (UUID, Foreign Key)
- `tool_name` (String)
- `payload` (JSONB) - Input arguments
- `status` (Enum: pending, running, success, failed)
- `result` (JSONB) - Output or error message
- `created_at` (Timestamp)
- `completed_at` (Timestamp)

## 5. Authentication Flow (mTLS / JWT + Signature)
1. **Provisioning:** Admin generates a single-use Bootstrap Token on Synapse.
2. **Registration:** Gateway sends its Name and Public Key to Synapse using the Bootstrap Token. Synapse returns a Node ID.
3. **Connection:** Gateway signs a connection request with its Private Key. Synapse verifies the signature against the stored Public Key and upgrades the connection to WSS.

## 6. Project Structure (Node.js / TypeScript)
```text
projects/synapse/
├── src/
│   ├── server.ts         # Main Fastify/Express + WSS entry point
│   ├── db/
│   │   ├── schema.sql    # DDL for Postgres
│   │   └── index.ts      # Connection pool
│   ├── auth/
│   │   └── crypto.ts     # Signature verification
│   ├── sockets/
│   │   ├── handler.ts    # Connection lifecycle
│   │   └── tools.ts      # RPC routing
│   └── mqtt/
│       └── broker.ts     # Internal or bridged MQTT logic
├── docs/
│   └── SPEC.md           # This document
├── package.json
└── tsconfig.json
```

## 7. Open Architecture Considerations

### 7.1. OpenClaw Client Integration
**Decision:** Native OpenClaw Plugin (`openclaw-plugin-synapse`).
The gateway will run a native plugin inside the OpenClaw daemon that establishes an outbound persistent WSS connection to the Synapse hub. It will listen for incoming RPC tool requests, execute them against the local OpenClaw runtime, and stream results back.

### 7.2. Payload Serialization (Binary vs. JSON)
**Decision:** Hybrid protocol (JSON + Binary frames) from Day 1.
The WSS connection will handle JSON frames for standard RPC metadata and text-based tool execution, but will natively support Binary frames for streaming files, images, or raw data to eliminate Base64 encoding overhead and improve performance.

### 7.3. Local Sandboxing vs. Central Authorization
**Decision:** Dual Verification (High Security).
Synapse acts as the first layer of authorization, confirming if a node has permission to execute a tool. The local OpenClaw daemon acts as the final gatekeeper, enforcing its own local `security` mode (e.g., allowlists, deny rules) before running the payload. Synapse cannot bypass a local security policy.

### 7.4. NAT, Firewalls, and Keepalives
**Decision:** Aggressive Keepalives (Fast Failure Detection).
Synapse will ping nodes every 10 seconds. If a node misses 2 consecutive pings (20 seconds total), Synapse will instantly mark the connection as dead, drop the socket, and set the node status to 'offline'. This prevents routing remote tool calls to a silent or partitioned node behind NAT.

### 7.5. Asynchronous Tool Timeouts
**Decision:** Asynchronous Callbacks (Webhooks).
For long-running tools, Synapse will instantly return an `execution_id` (Pending) to the requesting node. The target node will execute the tool asynchronously and, upon completion, push the result back to Synapse. Synapse will then actively route a "Job Complete" WSS event back to the original requesting node, eliminating the need for polling.