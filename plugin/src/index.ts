import WebSocket from 'ws';
import dotenv from 'dotenv';
import { exec } from 'child_process';
import { promisify } from 'util';

dotenv.config();

const execAsync = promisify(exec);

export class SynapsePlugin {
  private ws: WebSocket | null = null;
  private hubUrl: string;
  private nodeId: string;
  private privateKey: string; // Used for V2 auth, keeping structure ready
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(hubUrl: string, nodeId: string, privateKey: string) {
    this.hubUrl = hubUrl;
    this.nodeId = nodeId;
    this.privateKey = privateKey;
  }

  public connect() {
    console.log(`[Synapse Client] Connecting to ${this.hubUrl}...`);
    // Connect with token in query for V1
    this.ws = new WebSocket(`${this.hubUrl}/ws?token=${this.nodeId}`);

    this.ws.on('open', () => {
      console.log(`[Synapse Client] Connected to Hub as Node: ${this.nodeId}`);
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    });

    this.ws.on('message', async (data: Buffer, isBinary: boolean) => {
      if (isBinary) {
        console.log('[Synapse Client] Received binary frame (Not yet handled)');
        return;
      }

      try {
        const msg = JSON.parse(data.toString());
        if (msg.action === 'execute_tool') {
          await this.handleExecuteTool(msg);
        }
      } catch (err) {
        console.error('[Synapse Client] Failed to parse message:', err);
      }
    });

    this.ws.on('close', () => {
      console.log('[Synapse Client] Connection closed. Reconnecting in 5s...');
      this.scheduleReconnect();
    });

    this.ws.on('error', (err) => {
      console.error('[Synapse Client] WebSocket error:', err.message);
      this.ws?.close();
    });
  }

  private scheduleReconnect() {
    if (!this.reconnectTimer) {
      this.reconnectTimer = setTimeout(() => this.connect(), 5000);
    }
  }

  private async handleExecuteTool(msg: any) {
    const { execution_id, tool_name, payload } = msg;
    console.log(`[Synapse Client] Remote tool request: ${tool_name} (ID: ${execution_id})`);

    let result;
    try {
      // DUAL VERIFICATION: The plugin must interface with local OpenClaw security here.
      // For the V1 skeleton, we will mock tool execution or pass to local system tools safely.
      if (tool_name === 'exec') {
         // Warning: In production, this must run through OpenClaw's secure exec engine!
         const { stdout, stderr } = await execAsync(payload.command);
         result = { stdout, stderr };
      } else {
         result = { error: `Tool ${tool_name} not yet supported by Synapse Plugin` };
      }

      this.sendResult(execution_id, result);
    } catch (err: any) {
      this.sendResult(execution_id, { error: err.message });
    }
  }

  private sendResult(executionId: string, result: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const response = {
        action: 'tool_result',
        execution_id: executionId,
        result: result
      };
      this.ws.send(JSON.stringify(response));
      console.log(`[Synapse Client] Sent result for execution: ${executionId}`);
    } else {
      console.error(`[Synapse Client] Cannot send result, WS not open.`);
    }
  }
}

// If run standalone for testing
if (require.main === module) {
  const url = process.env.SYNAPSE_HUB_URL || 'ws://localhost:3000';
  const nodeId = process.env.SYNAPSE_NODE_ID || 'test-node-1';
  const plugin = new SynapsePlugin(url, nodeId, 'dummy-key');
  plugin.connect();
}