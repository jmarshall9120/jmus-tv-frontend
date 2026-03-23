# Chrome CDP Connection Setup for Cursor

To use your real Chrome profile (with localStorage, cookies, logins) in Cursor's browser automation.

## Step-by-Step Setup

### 1. Close ALL Chrome instances

**Important:** Chrome must be completely closed, or the new instance won't start with remote debugging.

- Close all Chrome windows
- Check Task Manager (Ctrl+Shift+Esc) → End any `chrome.exe` processes
- Make sure no Chrome processes are running

### 2. Launch Chrome with remote debugging

Open PowerShell and run:

```powershell
& "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
```

**Note:** Use `&` (ampersand) at the start - this is PowerShell syntax to run executables with spaces in the path.

### 3. Verify Chrome is listening

Open in your browser:
```
http://localhost:9222/json
```

You should see JSON output. Look for entries with `webSocketDebuggerUrl` fields.

### 4. Get the WebSocket URL

In the JSON response, find the browser target (usually the first entry or one with `type: "browser"`). Copy the `webSocketDebuggerUrl` value.

It will look like:
```
ws://127.0.0.1:9222/devtools/browser/abc123def456...
```

### 5. Configure Cursor

1. Open Cursor Settings → Tools → Browser Automation
2. Set to **"CDP Connection"**
3. Paste the `webSocketDebuggerUrl` into the CDP Connection URL field
4. Save/Apply

### 6. Test

Once configured, the AI can connect to your Chrome instance and will have access to:
- Your saved logins
- localStorage data
- Cookies
- Extensions
- Your normal browsing profile

## Troubleshooting

### "localhost refused to connect" when checking port 9222

**Cause:** Chrome didn't start with the `--remote-debugging-port` flag.

**Fix:**
1. Make sure ALL Chrome processes are closed (check Task Manager)
2. Launch Chrome fresh with the command above
3. Verify with `http://localhost:9222/json`

### Chrome won't close completely

If Chrome has breakpoints/debuggers attached:
1. Close any debugger dialogs manually
2. Use Task Manager to force-close Chrome processes
3. Wait a few seconds
4. Launch fresh with the remote debugging flag

### Port 9222 already in use

If you get an error that port 9222 is in use:
- Use a different port: `--remote-debugging-port=9223`
- Update the WebSocket URL accordingly: `ws://127.0.0.1:9223/devtools/browser/...`

### Cursor can't connect

- Make sure Chrome is still running with remote debugging enabled
- Verify the WebSocket URL is correct (starts with `ws://`)
- Try restarting Cursor after configuring the CDP Connection URL

## Alternative: Create a Chrome shortcut

To make this easier, create a desktop shortcut:

1. Right-click desktop → New → Shortcut
2. Target:
   ```
   "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
   ```
3. Name it "Chrome (Debug Mode)"
4. Use this shortcut whenever you want to use Chrome with Cursor
