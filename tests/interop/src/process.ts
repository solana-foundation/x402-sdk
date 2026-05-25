import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";
import { setTimeout as delay } from "node:timers/promises";
import type { AdapterMessage, ClientRunResult, ReadyMessage } from "./contracts";
import type { ImplementationDefinition } from "./implementations";

type RunningServer = {
  child: ChildProcess;
  ready: ReadyMessage;
};

type AdapterProcess = {
  child: ChildProcess;
  stderr: string[];
};

const ADAPTER_OUTPUT_TIMEOUT_MS = 120_000;
const MAX_STDERR_CHARS = 4_000;

function stderrDetails(adapter: AdapterProcess): string {
  const stderr = adapter.stderr.join("").trim();
  if (!stderr) {
    return "";
  }

  return `\nAdapter stderr:\n${stderr.slice(-MAX_STDERR_CHARS)}`;
}

function formatPayload(payload: AdapterMessage): string {
  return JSON.stringify(payload);
}

async function waitForJsonMessage<T extends AdapterMessage>(
  implementation: ImplementationDefinition,
  adapter: AdapterProcess,
  timeoutMs: number,
  expectedOutput: string,
): Promise<T> {
  const adapterName = `${implementation.role} adapter ${implementation.id}`;
  const { child } = adapter;

  if (!child.stdout) {
    throw new Error(`${adapterName} does not expose stdout`);
  }

  const readline = createInterface({ input: child.stdout });

  try {
    return await Promise.race([
      new Promise<T>((resolve, reject) => {
        readline.on("line", line => {
          if (!line.trim()) {
            return;
          }

          try {
            resolve(JSON.parse(line) as T);
          } catch (error) {
            reject(
              new Error(
                `${adapterName} wrote invalid JSON while waiting for ${expectedOutput}: ${line}\n${String(
                  error,
                )}`,
              ),
            );
          }
        });

        child.once("exit", code => {
          reject(
            new Error(
              `${adapterName} exited before ${expectedOutput} (code ${code ?? -1})${stderrDetails(
                adapter,
              )}`,
            ),
          );
        });
      }),
      delay(timeoutMs).then(() => {
        throw new Error(
          `Timed out waiting for ${expectedOutput} from ${adapterName} after ${timeoutMs}ms${stderrDetails(
            adapter,
          )}`,
        );
      }),
    ]);
  } finally {
    readline.close();
  }
}

function spawnAdapter(
  implementation: ImplementationDefinition,
  extraEnv: Record<string, string> = {},
): AdapterProcess {
  const [command, ...args] = implementation.command;
  // detached: true so the child gets its own process group; this lets us kill
  // grandchildren spawned via `sh -c "cd X && Y"` wrappers (luajit, go, ruby,
  // php, python adapters all do this). Without it SIGTERM only reaches the
  // wrapper and the real adapter leaks across matrix runs, eventually
  // exhausting RPC connection pools and port allocations.
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...extraEnv,
    },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });

  const stderr: string[] = [];
  child.stderr?.on("data", chunk => {
    stderr.push(String(chunk));
  });

  return { child, stderr };
}

function killAdapterTree(child: ChildProcess, signal: NodeJS.Signals): void {
  if (child.pid === undefined) {
    return;
  }
  try {
    process.kill(-child.pid, signal);
  } catch {
    try {
      child.kill(signal);
    } catch {
      // child already exited
    }
  }
}

export async function startServer(
  implementation: ImplementationDefinition,
  extraEnv: Record<string, string> = {},
): Promise<RunningServer> {
  const adapter = spawnAdapter(implementation, extraEnv);
  const ready = await waitForJsonMessage<ReadyMessage>(
    implementation,
    adapter,
    ADAPTER_OUTPUT_TIMEOUT_MS,
    "server readiness",
  );

  if (ready.type !== "ready" || ready.role !== "server" || !ready.port) {
    killAdapterTree(adapter.child, "SIGTERM");
    throw new Error(
      `Unexpected server readiness payload from ${implementation.id}: ${formatPayload(ready)}`,
    );
  }

  if (ready.implementation !== implementation.id) {
    killAdapterTree(adapter.child, "SIGTERM");
    throw new Error(
      `Server adapter ${implementation.id} reported implementation ${ready.implementation}`,
    );
  }

  return { child: adapter.child, ready };
}

export async function runClient(
  implementation: ImplementationDefinition,
  targetUrl: string,
  extraEnv: Record<string, string> = {},
): Promise<ClientRunResult> {
  const adapter = spawnAdapter(implementation, {
    X402_INTEROP_TARGET_URL: targetUrl,
    ...extraEnv,
  });

  const result = await waitForJsonMessage<ClientRunResult>(
    implementation,
    adapter,
    ADAPTER_OUTPUT_TIMEOUT_MS,
    "client result",
  );
  await new Promise<void>((resolve, reject) => {
    adapter.child.once("exit", code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Client adapter exited with code ${code ?? -1}${stderrDetails(adapter)}`));
      }
    });
  });

  if (result.type !== "result" || result.role !== "client") {
    throw new Error(
      `Unexpected client result payload from ${implementation.id}: ${formatPayload(result)}`,
    );
  }

  if (result.implementation !== implementation.id) {
    throw new Error(
      `Client adapter ${implementation.id} reported implementation ${result.implementation}`,
    );
  }

  return result;
}

export async function stopServer(server: RunningServer): Promise<void> {
  if (server.child.exitCode !== null || server.child.signalCode !== null) {
    return;
  }
  const exited = new Promise<void>(resolve => {
    server.child.once("exit", () => resolve());
  });
  killAdapterTree(server.child, "SIGTERM");
  await Promise.race([
    exited,
    delay(5_000).then(() => {
      killAdapterTree(server.child, "SIGKILL");
    }),
  ]);
  // Always await the actual exit so the port is fully released before the
  // caller proceeds. SIGKILL is asynchronous and can take a tick after the
  // signal returns.
  await exited;
}
