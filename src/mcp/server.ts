import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { MCP_TOOLS, executeMCPTool } from './tools.js';
import { createMCPLogger } from '../utils/logging.js';

/**
 * MCP Server for Cursor IDE integration
 * 
 * This server exposes tools that allow Cursor AI to interact with
 * the AI PR Reviewer - querying review status, getting recommendations,
 * creating issues, etc.
 * 
 * IMPORTANT: This server uses stderr for logging because stdout is reserved
 * for JSON-RPC communication with the MCP client.
 */
export async function startMCPServer(): Promise<void> {
  // Use stderr logger to avoid interfering with JSON-RPC on stdout
  const mcpLogger = createMCPLogger('ai-pr-reviewer').child({ component: 'mcp-server' });
  
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
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    mcpLogger.debug('List tools requested');
    return {
      tools: MCP_TOOLS,
    };
  });

  // Execute tool
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
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
// Only run if not in test environment
if (require.main === module && process.env.NODE_ENV !== 'test') {
  startMCPServer().catch((error) => {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  });
}

