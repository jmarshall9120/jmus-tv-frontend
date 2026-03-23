# Browser MCP setup (Chrome + Cursor)

Use this so the AI can see and interact with your app in Chrome for debugging.

## 1. Install the Chrome extension

1. Go to **[Browser MCP – Install](https://browsermcp.io/install)** (Chrome Web Store).
2. Click **Add to Chrome** and confirm.
3. **Pin the extension**: click the puzzle icon in the toolbar → find "Browser MCP" → click the pin so it stays visible.
4. When you want to debug: open your app in a tab, click the **Browser MCP** icon, then click **Connect**.  
   The AI will control this connected tab.

## 2. Add the MCP server in Cursor

**Option A – Project-level (this repo)**  
This project already has `.cursor/mcp.json` with the `browsermcp` server. Open the project in Cursor; it should load automatically. If not, add manually via Option B.

**Option B – Manual in Settings**  
1. Open **Cursor Settings** → **Tools & MCP**.  
2. Click **Add Custom MCP**.  
3. Add the server (same config as in `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "browsermcp": {
      "command": "npx",
      "args": ["@browsermcp/mcp@latest"]
    }
  }
}
```

4. Save and refresh the server; restart Cursor if it doesn’t appear.  
5. On Windows, if project-level MCP doesn’t load, use this manual add.

## 3. Use it

- Open your app in **Chrome** (e.g. `http://localhost:3000`).
- In the tab, open the **Browser MCP** extension and click **Connect**.
- In Cursor, you can ask the AI to e.g. “Open the match-tables page and tell me what you see” or “Click the first row and describe the result.”  
  The AI will use Browser MCP to drive the connected tab.

## Requirements

- **Node.js** installed (so `npx @browsermcp/mcp@latest` works).
- Chrome with the Browser MCP extension installed and the tab **Connected**.

## Troubleshooting

- **MCP / Tools not in Cursor**  
  Update Cursor and look under **Tools** or **Integrations** for MCP.

- **Browser MCP server errors**  
  Run in a terminal: `npx @browsermcp/mcp@latest` and fix any Node/npx errors.

- **AI doesn’t use the browser**  
  Restart Cursor after adding the server; say explicitly “use the browser” or “use Browser MCP to open …”.

- **Nothing happens in the tab**  
  Make sure you clicked **Connect** in the Browser MCP extension on that tab.

- **"Waiting for Approval" but no Approve button**  
  Known Cursor bug: status bar shows "Waiting for Approval" for MCP tools but no Approve control. Try: (1) **click the "Waiting for Approval" text** in the bottom-left status bar; (2) look in the agent message for a "Run tool" / approval control; (3) **update Cursor**; (4) see [Cursor Forum – no approve button](https://forum.cursor.com/t/waiting-on-approval-to-run-a-mcp-command-but-no-button-or-prompt-to-approve/150025).

- **Allow Browser MCP without approval (MCP Allowlist)**  
  Cursor Settings → Agents → Auto-Run → **MCP Allowlist**. Add the Browser MCP tool identifiers so they run without a prompt. Use the exact string Cursor shows when it asks for approval (e.g. `project-0-stryker-frontend-browsermcp-browser_get_console_logs`). All tools from the `browsermcp` server:
  - `browsermcp-browser_navigate`
  - `browsermcp-browser_go_back`
  - `browsermcp-browser_go_forward`
  - `browsermcp-browser_snapshot`
  - `browsermcp-browser_click`
  - `browsermcp-browser_hover`
  - `browsermcp-browser_type`
  - `browsermcp-browser_select_option`
  - `browsermcp-browser_press_key`
  - `browsermcp-browser_wait`
  - `browsermcp-browser_get_console_logs`
  - `browsermcp-browser_screenshot`  
  If your Cursor version uses a project-prefixed id, use that instead (e.g. `project-0-stryker-frontend-browsermcp-browser_get_console_logs`). Alternatively, enable **Run Everything** in Auto-Run Mode to allow all MCP tools without listing them.

## Reference

- [Browser MCP – Set up MCP server](https://docs.browsermcp.io/setup-server)
- [Browser MCP – Set up extension](https://docs.browsermcp.io/setup-extension)
