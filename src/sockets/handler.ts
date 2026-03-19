import { WebSocket } from 'ws';
import { db } from '../db';
import { FastifyRequest } from 'fastify';

// Store active connections
export const activeNodes = new Map<string, WebSocket>();

interface SynapseWebSocket extends WebSocket {
  isAlive: boolean;
  nodeId: string;
}

export async function setupWebSocket(ws: WebSocket, req: FastifyRequest) {
  const extWs = ws as SynapseWebSocket;
  extWs.isAlive = true;
  
  // Basic token extraction from query string for V1 auth
  const token = (req.query as any).token;
  if (!token) {
    ws.close(4001, 'Unauthorized: No token');
    return;
  }
  
  // In a full implementation, we'd verify the JWT and signature here.
  // For now, assume token is the nodeId for simplicity in V1 testing.
  const nodeId = token as string;
  extWs.nodeId = nodeId;
  
  activeNodes.set(nodeId, ws);
  console.log(`[WSS] Node ${nodeId} connected`);
  
  // Update DB status
  try {
    await db.query(`UPDATE nodes SET status = 'online', last_seen = NOW() WHERE id = $1`, [nodeId]);
  } catch (err) {
    console.error(`Failed to update DB for node ${nodeId}`, err);
  }

  ws.on('pong', () => {
    extWs.isAlive = true;
  });

  ws.on('message', async (message: Buffer, isBinary: boolean) => {
    if (isBinary) {
      console.log(`[WSS] Received binary frame from ${nodeId}, length: ${message.length}`);
      // Handle binary file streams
    } else {
      const data = message.toString();
      console.log(`[WSS] Received JSON from ${nodeId}: ${data}`);
      try {
        const payload = JSON.parse(data);
        // Route tool results or MQTT syncs here
        if (payload.action === 'tool_result' && payload.execution_id) {
          await db.query(
            `UPDATE executions SET status = 'success', result = $1, completed_at = NOW() WHERE id = $2`,
            [JSON.stringify(payload.result), payload.execution_id]
          );
        }
      } catch (err) {
        console.error('Failed to parse WS message', err);
      }
    }
  });

  ws.on('close', async () => {
    console.log(`[WSS] Node ${nodeId} disconnected`);
    activeNodes.delete(nodeId);
    try {
      await db.query(`UPDATE nodes SET status = 'offline', last_seen = NOW() WHERE id = $1`, [nodeId]);
    } catch (err) {}
  });
}

// Aggressive Keepalive: Ping every 10s. If no pong after 20s (missed 2 pings), drop.
setInterval(() => {
  activeNodes.forEach((ws, nodeId) => {
    const extWs = ws as SynapseWebSocket;
    if (!extWs.isAlive) {
      console.log(`[WSS] Node ${nodeId} missed ping. Terminating connection.`);
      activeNodes.delete(nodeId);
      extWs.terminate();
      
      // Mark offline in DB
      db.query(`UPDATE nodes SET status = 'offline', last_seen = NOW() WHERE id = $1`, [nodeId]).catch(console.error);
      return;
    }
    
    extWs.isAlive = false;
    extWs.ping();
  });
}, 10000);
