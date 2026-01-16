# Ping-a-Ding-a-Ling

A real-time network latency monitor for diagnosing router problems, flaky connections, and other network gremlins. Useful for figuring out why your video calls drop or your games lag.

## How it works

The app continuously pings a target (your router, a DNS server, whatever) and visualizes latency, jitter, and packet loss in real-time. It detects anomalies using statistical analysis and logs deviations so you can spot patterns.

## Prerequisites

[Node.js](https://nodejs.org/) v18 or later.

## Running

```bash
npx ping-a-ding-a-ling
```

This starts a local server and opens the UI in your browser. By default it runs on port 3001.

```bash
npx ping-a-ding-a-ling --port=8080    # use a different port
npx ping-a-ding-a-ling --no-browser   # don't auto-open browser
```

## Data storage

Session history and ping data are stored locally in a SQLite database:

- **macOS**: `~/Library/Application Support/ping-a-ding-a-ling/`
- **Windows**: `%APPDATA%\ping-a-ding-a-ling\`
- **Linux**: `~/.local/share/ping-a-ding-a-ling/`

## Uninstalling

To remove all traces of the app including your session data, delete the data directory listed above. If you installed globally, also run:

```bash
npm uninstall -g ping-a-ding-a-ling
```

## License

MIT
