import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';

const execAsync = promisify(exec);

export async function getDefaultGateway(): Promise<string | null> {
  const platform = os.platform();

  try {
    if (platform === 'darwin') {
      const { stdout } = await execAsync('route -n get default 2>/dev/null');
      const match = stdout.match(/gateway:\s*(\S+)/);
      return match ? match[1] : null;
    }

    if (platform === 'linux') {
      // Try ip route first (modern), fall back to route command
      try {
        const { stdout } = await execAsync('ip route 2>/dev/null');
        const match = stdout.match(/default\s+via\s+(\S+)/);
        if (match) return match[1];
      } catch {
        // ip command not available, try route
      }

      const { stdout } = await execAsync('route -n 2>/dev/null');
      const lines = stdout.split('\n');
      for (const line of lines) {
        if (line.startsWith('0.0.0.0')) {
          const parts = line.split(/\s+/);
          if (parts[1]) return parts[1];
        }
      }
      return null;
    }

    if (platform === 'win32') {
      const { stdout } = await execAsync('route print 0.0.0.0');
      const lines = stdout.split('\n');
      for (const line of lines) {
        // Look for line with 0.0.0.0 destination
        if (line.includes('0.0.0.0') && !line.includes('On-link')) {
          const parts = line.trim().split(/\s+/);
          // Format: Network Destination, Netmask, Gateway, Interface, Metric
          if (parts.length >= 3 && parts[0] === '0.0.0.0') {
            return parts[2];
          }
        }
      }
      return null;
    }

    return null;
  } catch {
    return null;
  }
}
