import { db } from '../db';
import { activeNodes } from './handler';
import { v4 as uuidv4 } from 'uuid';

export async function requestRemoteTool(sourceNodeId: string, targetNodeId: string, toolName: string, payload: any) {
  // 1. Verify target is online
  const targetWs = activeNodes.get(targetNodeId);
  if (!targetWs) {
    throw new Error(`Target node ${targetNodeId} is offline`);
  }

  // 2. Check permissions (Dual verification implies we check here, then target checks locally)
  const permRes = await db.query(
    `SELECT allowed_tools FROM permissions WHERE source_node_id = $1 AND target_node_id = $2`,
    [sourceNodeId, targetNodeId]
  );

  if (permRes.rows.length === 0) {
    throw new Error(`Unauthorized: No permissions defined from ${sourceNodeId} to ${targetNodeId}`);
  }

  const allowedTools: string[] = permRes.rows[0].allowed_tools || [];
  if (!allowedTools.includes(toolName) && !allowedTools.includes('*')) {
    throw new Error(`Unauthorized: Tool ${toolName} not allowed`);
  }

  // 3. Create Execution Record
  const executionId = uuidv4();
  await db.query(
    `INSERT INTO executions (id, source_node_id, target_node_id, tool_name, payload, status) VALUES ($1, $2, $3, $4, $5, 'pending')`,
    [executionId, sourceNodeId, targetNodeId, toolName, JSON.stringify(payload)]
  );

  // 4. Send request to target node
  const requestMsg = {
    action: 'execute_tool',
    execution_id: executionId,
    source_node_id: sourceNodeId,
    tool_name: toolName,
    payload: payload
  };

  targetWs.send(JSON.stringify(requestMsg));

  // 5. Return execution ID immediately for async callback processing
  return {
    execution_id: executionId,
    status: 'pending'
  };
}