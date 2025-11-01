import { Server } from "modelcontextprotocol/sdk/server/index.js";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

const server = new Server({
  name: "local-app-helper",
  version: "0.1.0",
});

server.tool(
  "say_hello",
  {
    description: "Renvoie un message de bienvenue personnalisé",
    inputSchema: z.object({
      name: z.string().describe("Ton prénom ou pseudo"),
    }),
  },
  async ({ input }) => {
    return {
      content: [
        {
          type: "text",
          text: `👋 Bonjour ${input.name}, ton serveur MCP local fonctionne parfaitement !`,
        },
      ],
    };
  }
);

server.run();
