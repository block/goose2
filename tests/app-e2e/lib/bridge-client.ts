import net from "node:net";

const PORT = 9999;

interface BridgeCommand {
  action: string;
  selector?: string;
  value?: string;
  timeout?: number;
}

interface BridgeResult {
  success: boolean;
  data?: string;
  error?: string;
}

export interface Bridge {
  snapshot: () => Promise<string>;
  click: (selector?: string, options?: { timeout?: number }) => Promise<string>;
  fill: (
    selector: string,
    value: string,
    options?: { timeout?: number },
  ) => Promise<string>;
  getText: (
    selector?: string,
    options?: { timeout?: number },
  ) => Promise<string>;
  count: (selector: string) => Promise<number>;
  keypress: (
    selector?: string,
    key?: string,
    options?: { timeout?: number },
  ) => Promise<string>;
  waitForText: (
    text: string,
    options?: { selector?: string; timeout?: number },
  ) => Promise<string>;
  scroll: (direction?: string) => Promise<string>;
  screenshot: (path?: string) => Promise<string>;
  close: () => void;
}

function send(socket: net.Socket, command: BridgeCommand): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    const onData = (chunk: Buffer) => {
      data += chunk.toString();
      if (data.includes("\n")) {
        socket.removeListener("data", onData);
        try {
          const parsed: BridgeResult = JSON.parse(data.trim());
          if (parsed.success) {
            resolve(parsed.data ?? "");
          } else {
            reject(new Error(parsed.error || "Unknown bridge error"));
          }
        } catch (_e) {
          reject(new Error(`Invalid response: ${data}`));
        }
      }
    };
    socket.on("data", onData);
    socket.write(`${JSON.stringify(command)}\n`);
  });
}

/**
 * Create a bridge connection to the Tauri test bridge.
 * Returns an object with methods for each bridge command.
 */
export async function createBridge({
  port = PORT,
}: {
  port?: number;
} = {}): Promise<Bridge> {
  const socket = net.createConnection({ port, host: "127.0.0.1" });

  await new Promise<void>((resolve, reject) => {
    socket.on("connect", resolve);
    socket.on("error", (err) => {
      reject(
        new Error(
          `Cannot connect to test bridge on port ${port}. ` +
            `Is the Tauri app running with --features test-bridge? (${err.message})`,
        ),
      );
    });
  });

  return {
    snapshot() {
      return send(socket, { action: "snapshot" });
    },
    click(selector?: string, options?: { timeout?: number }) {
      return send(socket, {
        action: "click",
        selector,
        timeout: options?.timeout,
      });
    },
    fill(selector: string, value: string, options?: { timeout?: number }) {
      return send(socket, {
        action: "fill",
        selector,
        value,
        timeout: options?.timeout,
      });
    },
    getText(selector?: string, options?: { timeout?: number }) {
      return send(socket, {
        action: "getText",
        selector,
        timeout: options?.timeout,
      });
    },
    count(selector: string) {
      return send(socket, { action: "count", selector }).then(Number);
    },
    keypress(selector?: string, key?: string, options?: { timeout?: number }) {
      return send(socket, {
        action: "keypress",
        selector,
        value: key,
        timeout: options?.timeout,
      });
    },
    waitForText(
      text: string,
      options?: { selector?: string; timeout?: number },
    ) {
      return send(socket, {
        action: "waitForText",
        selector: options?.selector ?? "body",
        value: text,
        timeout: options?.timeout ?? 30000,
      });
    },
    scroll(direction?: string) {
      return send(socket, { action: "scroll", value: direction });
    },
    screenshot(path?: string) {
      return send(socket, { action: "screenshot", value: path });
    },
    close() {
      socket.end();
    },
  };
}
