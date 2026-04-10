import net from "net";

const PORT = 9999;

interface BridgeCommand {
  action: string;
  selector?: string;
  value?: string;
}

interface BridgeResult {
  success: boolean;
  data?: string;
  error?: string;
}

export interface Bridge {
  snapshot: () => Promise<string>;
  click: (selector?: string) => Promise<string>;
  fill: (selector: string, value: string) => Promise<string>;
  getText: (selector?: string) => Promise<string>;
  count: (selector: string) => Promise<number>;
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
    socket.write(JSON.stringify(command) + "\n");
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
    click(selector?: string) {
      return send(socket, { action: "click", selector });
    },
    fill(selector: string, value: string) {
      return send(socket, { action: "fill", selector, value });
    },
    getText(selector?: string) {
      return send(socket, { action: "getText", selector });
    },
    count(selector: string) {
      return send(socket, { action: "count", selector }).then(Number);
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
