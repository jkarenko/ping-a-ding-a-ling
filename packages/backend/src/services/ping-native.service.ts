import { exec } from 'child_process';
import os from 'os';

interface PingResponse {
  alive: boolean;
  time: number | null;
}

/**
 * Cross-platform ping implementation that handles non-English Windows locales.
 * Parses ping output using numeric patterns rather than language-specific keywords.
 */
export async function execPing(target: string, timeoutSeconds: number): Promise<PingResponse> {
  const platform = os.platform();
  const cmd = buildPingCommand(target, timeoutSeconds, platform);

  return new Promise((resolve) => {
    exec(cmd, { timeout: (timeoutSeconds + 2) * 1000 }, (error, stdout, stderr) => {
      // Even if exec returns an error, we might have output to parse
      // (e.g., "Request timed out" still produces output)
      const output = stdout + stderr;

      if (error && !output) {
        resolve({ alive: false, time: null });
        return;
      }

      const time = parseLatency(output, platform);
      resolve({
        alive: time !== null,
        time,
      });
    });
  });
}

function buildPingCommand(target: string, timeoutSeconds: number, platform: string): string {
  // Escape the target to prevent command injection
  const safeTarget = target.replace(/[;&|`$()]/g, '');

  if (platform === 'win32') {
    // Windows: -n count, -w timeout in milliseconds
    const timeoutMs = Math.max(1000, timeoutSeconds * 1000);
    return `ping -n 1 -w ${timeoutMs} ${safeTarget}`;
  } else {
    // macOS/Linux: -c count, -W timeout in seconds (macOS uses -W in ms on some versions)
    if (platform === 'darwin') {
      // macOS: -W is in milliseconds
      const timeoutMs = Math.max(1000, timeoutSeconds * 1000);
      return `ping -c 1 -W ${timeoutMs} ${safeTarget}`;
    } else {
      // Linux: -W is in seconds
      return `ping -c 1 -W ${Math.max(1, timeoutSeconds)} ${safeTarget}`;
    }
  }
}

function parseLatency(output: string, platform: string): number | null {
  if (!output) return null;

  // Check for common failure indicators (language-agnostic where possible)
  const lowerOutput = output.toLowerCase();
  if (
    lowerOutput.includes('request timed out') ||
    lowerOutput.includes('timed out') ||
    lowerOutput.includes('unreachable') ||
    lowerOutput.includes('100% packet loss') ||
    lowerOutput.includes('100% loss') ||
    lowerOutput.includes('could not find host') ||
    lowerOutput.includes('unknown host') ||
    lowerOutput.includes('name or service not known') ||
    lowerOutput.includes('délai d\'attente') || // French timeout
    lowerOutput.includes('zeitüberschreitung') || // German timeout
    lowerOutput.includes('tiempo de espera') // Spanish timeout
  ) {
    return null;
  }

  // Try multiple patterns to extract latency
  // These patterns are designed to work across different locales

  // Pattern 1: time=XXms, time=XX.XXms, tiempo=XXms, temps=XXms, Zeit=XXms
  // Matches: time=5ms, time=5.23ms, tiempo=5ms, temps<1ms
  const timeEqualsPattern = /(?:time|tiempo|temps|zeit|aika|tid|tempo)[=<](\d+(?:\.\d+)?)\s*ms/i;
  let match = output.match(timeEqualsPattern);
  if (match) {
    return parseFloat(match[1]);
  }

  // Pattern 2: Windows often shows "Reply from X: bytes=32 time=5ms TTL=64"
  // or localized: "Respuesta desde X: bytes=32 tiempo=5ms TTL=64"
  // Look for the numeric value before "ms" that follows bytes=XX
  const bytesTimePattern = /bytes[=:]\d+\s+\S+[=<](\d+(?:\.\d+)?)\s*ms/i;
  match = output.match(bytesTimePattern);
  if (match) {
    return parseFloat(match[1]);
  }

  // Pattern 3: Look for "XX.XX ms" or "XX ms" pattern (common in stats line)
  // This is more aggressive - finds any number followed by ms
  const loosePattern = /[=<\s](\d+(?:\.\d+)?)\s*ms/i;
  match = output.match(loosePattern);
  if (match) {
    return parseFloat(match[1]);
  }

  // Pattern 4: macOS/Linux format in stats: min/avg/max/stddev = 5.123/5.456/5.789/0.123 ms
  const statsPattern = /(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)/;
  match = output.match(statsPattern);
  if (match) {
    // Return the first value (which is min for a single ping, effectively the time)
    return parseFloat(match[1]);
  }

  // Pattern 5: Just look for any reasonable latency number before "ms"
  // Be careful not to match things like "64ms" from TTL
  const anyMsPattern = /(\d+(?:\.\d+)?)\s*ms(?:\s|$|,)/i;
  match = output.match(anyMsPattern);
  if (match) {
    const value = parseFloat(match[1]);
    // Sanity check - latency should be reasonable (< 10000ms)
    if (value < 10000) {
      return value;
    }
  }

  return null;
}
