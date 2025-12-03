import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { MCP_TOOLS, executeMCPTool } from './tools';
import { logger } from '../utils/logging';

/**
 * MCP Server for Cursor IDE integration
 * 
 * This server exposes tools that allow Cursor AI to interact with
 * the AI PR Reviewer - querying review status, getting recommendations,
 * creating issues, etc.
 */
export async function startMCPServer(): Promise<void> {
  const mcpLogger = logger.child({ component: 'mcp-server' });
  
  // Create MCP server
  const server = new Server(
    {
      name: 'ai-pr-reviewer',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List available tools
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (server as any).setRequestHandler('tools/list', async () => {
    mcpLogger.debug('List tools requested');
    return {
      tools: MCP_TOOLS,
    };
  });

  // Execute tool
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (server as any).setRequestHandler('tools/call', async (request: any) => {
    const { name, arguments: args } = request.params;
    mcpLogger.info({ tool: name }, 'Tool call requested');

    try {
      const result = await executeMCPTool(name, args || {});
      mcpLogger.debug({ tool: name }, 'Tool executed successfully');
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      mcpLogger.error({ error, tool: name }, 'Tool execution failed');
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: error instanceof Error ? error.message : 'Unknown error',
            }),
          },
        ],
        isError: true,
      };
    }
  });

  // Start server with stdio transport (for Cursor)
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  mcpLogger.info('MCP server started and ready');
}

// If running as a standalone script
if (require.main === module) {
  startMCPServer().catch((error) => {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  });
}

