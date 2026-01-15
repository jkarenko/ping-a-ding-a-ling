declare module 'ping' {
  interface PingConfig {
    timeout?: number;
    min_reply?: number;
    extra?: string[];
  }

  interface PingResponse {
    inputHost: string;
    host: string;
    alive: boolean;
    output: string;
    time: number | 'unknown';
    times: number[];
    min: string;
    max: string;
    avg: string;
    stddev: string;
    packetLoss: string;
    numeric_host?: string;
  }

  interface PingPromise {
    probe(host: string, config?: PingConfig): Promise<PingResponse>;
  }

  const promise: PingPromise;

  export { promise };
  export default { promise };
}
