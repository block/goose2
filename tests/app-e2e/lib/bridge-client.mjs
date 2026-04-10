import net from "net";

const PORT = 9999;

function send(socket, command) {
  return new Promise((resolve, reject) => {
    let data = "";
    const onData = (chunk) => {
      data += chunk.toString();
      if (data.includes("\n")) {
        socket.removeListener("data", onData);
        try {
          resolve(JSON.parse(data.trim()));
        } catch (_e) {
          reject(new Error(`Invalid response: ${data}`));
        }
      }
    };
    socket.on("data", onData);
    socket.write(JSON.stringify(command) + "\n");
  });
}

async function main() {
  const [action, selector, value] = process.argv.slice(2);

  if (!action) {
    console.log(`Usage:
  node bridge-client.mjs snapshot
  node bridge-client.mjs click "[data-tid='e1']"
  node bridge-client.mjs fill "[data-tid='e1']" Alice
  node bridge-client.mjs getText p
  node bridge-client.mjs scroll down|up|top|bottom
  node bridge-client.mjs screenshot [output.png]`);
    process.exit(0);
  }

  const socket = net.createConnection({ port: PORT, host: "127.0.0.1" });

  await new Promise((resolve, _reject) => {
    socket.on("connect", resolve);
    socket.on("error", () => {
      console.error(
        "Cannot connect. Is the Tauri app running with --features test-bridge?",
      );
      process.exit(1);
    });
  });

  const cmd = { action };
  if (action === "screenshot") {
    // screenshot takes a file path as the second arg
    cmd.value =
      selector || `tests/app-e2e/screenshots/screenshot-${Date.now()}.png`;
  } else {
    if (selector) cmd.selector = selector;
    if (value) cmd.value = value;
  }

  const result = await send(socket, cmd);

  if (result.success) {
    console.log(result.data);
  } else {
    console.error("Error:", result.error);
    process.exit(1);
  }

  socket.end();
}

main();
