"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestRemoteTool = requestRemoteTool;
const db_1 = require("../db");
const handler_1 = require("./handler");
const uuid_1 = require("uuid");
async function requestRemoteTool(sourceNodeId, targetNodeId, toolName, payload) {
    // 1. Verify target is online
    const targetWs = handler_1.activeNodes.get(targetNodeId);
    if (!targetWs) {
        throw new Error(`Target node ${targetNodeId} is offline`);
    }
    // 2. Check permissions (Dual verification implies we check here, then target checks locally)
    const permRes = await db_1.db.query(`SELECT allowed_tools FROM permissions WHERE source_node_id = $1 AND target_node_id = $2`, [sourceNodeId, targetNodeId]);
    if (permRes.rows.length === 0) {
        throw new Error(`Unauthorized: No permissions defined from ${sourceNodeId} to ${targetNodeId}`);
    }
    const allowedTools = permRes.rows[0].allowed_tools || [];
    if (!allowedTools.includes(toolName) && !allowedTools.includes('*')) {
        throw new Error(`Unauthorized: Tool ${toolName} not allowed`);
    }
    // 3. Create Execution Record
    const executionId = (0, uuid_1.v4)();
    await db_1.db.query(`INSERT INTO executions (id, source_node_id, target_node_id, tool_name, payload, status) VALUES ($1, $2, $3, $4, $5, 'pending')`, [executionId, sourceNodeId, targetNodeId, toolName, JSON.stringify(payload)]);
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
