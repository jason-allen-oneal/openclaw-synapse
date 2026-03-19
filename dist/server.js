"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const websocket_1 = __importDefault(require("@fastify/websocket"));
const handler_1 = require("./sockets/handler");
const tools_1 = require("./sockets/tools");
const dotenv_1 = __importDefault(require("dotenv"));
const db_1 = require("./db");
dotenv_1.default.config();
const server = (0, fastify_1.default)({ logger: true });
// Register WebSocket plugin
server.register(websocket_1.default);
// Setup WSS Route
server.register(async function (fastify) {
    fastify.get('/ws', { websocket: true }, (connection, req) => {
        (0, handler_1.setupWebSocket)(connection, req);
    });
});
// REST API: Trigger a remote tool call (used by the hub admin or another node via API)
server.post('/api/v1/execute', async (request, reply) => {
    const { source_node_id, target_node_id, tool_name, payload } = request.body;
    if (!source_node_id || !target_node_id || !tool_name) {
        return reply.status(400).send({ error: 'Missing required fields' });
    }
    try {
        const result = await (0, tools_1.requestRemoteTool)(source_node_id, target_node_id, tool_name, payload);
        return reply.status(200).send(result);
    }
    catch (err) {
        return reply.status(403).send({ error: err.message });
    }
});
// REST API: Healthcheck
server.get('/health', async (request, reply) => {
    return { status: 'Synapse Hub is operational' };
});
const start = async () => {
    try {
        // Quick DB check
        await db_1.db.query('SELECT NOW()');
        server.log.info('Database connected successfully.');
        await server.listen({ port: parseInt(process.env.PORT || '3000'), host: '0.00.0.0' });
        console.log(`[Synapse] Server listening on ${server.server.address()}`);
    }
    catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};
start();
