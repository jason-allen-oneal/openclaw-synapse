import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import { setupWebSocket } from './sockets/handler';
import { requestRemoteTool } from './sockets/tools';
import dotenv from 'dotenv';
import { db } from './db';

dotenv.config();

const server = Fastify({ logger: true });

// Register WebSocket plugin
server.register(fastifyWebsocket);

// Setup WSS Route
server.register(async function (fastify) {
  fastify.get('/ws', { websocket: true }, (connection, req) => {
    setupWebSocket(connection as any, req);
  });
});

// REST API: Trigger a remote tool call (used by the hub admin or another node via API)
server.post('/api/v1/execute', async (request, reply) => {
  const { source_node_id, target_node_id, tool_name, payload } = request.body as any;
  
  if (!source_node_id || !target_node_id || !tool_name) {
    return reply.status(400).send({ error: 'Missing required fields' });
  }

  try {
    const result = await requestRemoteTool(source_node_id, target_node_id, tool_name, payload);
    return reply.status(200).send(result);
  } catch (err: any) {
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
    await db.query('SELECT NOW()');
    server.log.info('Database connected successfully.');

    await server.listen({ port: parseInt(process.env.PORT || '3000'), host: '0.00.0.0' });
    console.log(`[Synapse] Server listening on ${server.server.address()}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();