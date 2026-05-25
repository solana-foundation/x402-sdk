import { describe, expect, it } from "vitest";
import { runClient, startServer } from "../src/process";
import type { ImplementationDefinition } from "../src/implementations";
import { supportedInteropCapabilities } from "../src/contracts";

function implementation(command: string[], role: "client" | "server"): ImplementationDefinition {
  return {
    id: "expected",
    label: "Expected adapter",
    role,
    command,
    capabilities: supportedInteropCapabilities,
    enabled: true,
  };
}

describe("interop process harness", () => {
  it("rejects a server adapter that reports a different implementation id", async () => {
    const command = [
      process.execPath,
      "-e",
      [
        "console.log(JSON.stringify({",
        "type: 'ready',",
        "implementation: 'other',",
        "role: 'server',",
        "port: 1234",
        "}));",
        "setInterval(() => {}, 1000);",
      ].join(""),
    ];

    await expect(startServer(implementation(command, "server"))).rejects.toThrow(
      "Server adapter expected reported implementation other",
    );
  });

  it("includes the server adapter id when readiness output is invalid JSON", async () => {
    const command = [process.execPath, "-e", "console.log('not json')"];

    await expect(startServer(implementation(command, "server"))).rejects.toThrow(
      "server adapter expected wrote invalid JSON while waiting for server readiness: not json",
    );
  });

  it("includes server stderr when readiness fails before output", async () => {
    const command = [process.execPath, "-e", "console.error('server boot failed'); process.exit(2);"];

    await expect(startServer(implementation(command, "server"))).rejects.toThrow(
      "server adapter expected exited before server readiness (code 2)\nAdapter stderr:\nserver boot failed",
    );
  });

  it("includes malformed server readiness payloads in the failure", async () => {
    const command = [
      process.execPath,
      "-e",
      [
        "console.log(JSON.stringify({",
        "type: 'ready',",
        "implementation: 'expected',",
        "role: 'server'",
        "}));",
        "setInterval(() => {}, 1000);",
      ].join(""),
    ];

    await expect(startServer(implementation(command, "server"))).rejects.toThrow(
      'Unexpected server readiness payload from expected: {"type":"ready","implementation":"expected","role":"server"}',
    );
  });

  it("rejects JSON stdout messages before server readiness", async () => {
    const command = [
      process.execPath,
      "-e",
      [
        "console.log(JSON.stringify({type: 'log', message: 'booting'}));",
        "console.log(JSON.stringify({",
        "type: 'ready',",
        "implementation: 'expected',",
        "role: 'server',",
        "port: 1234",
        "}));",
        "setInterval(() => {}, 1000);",
      ].join(""),
    ];

    await expect(startServer(implementation(command, "server"))).rejects.toThrow(
      'Unexpected server readiness payload from expected: {"type":"log","message":"booting"}',
    );
  });

  it("rejects a client adapter that reports a different implementation id", async () => {
    const command = [
      process.execPath,
      "-e",
      [
        "console.log(JSON.stringify({",
        "type: 'result',",
        "implementation: 'other',",
        "role: 'client',",
        "ok: true,",
        "status: 200,",
        "responseHeaders: {},",
        "responseBody: {}",
        "}));",
      ].join(""),
    ];

    await expect(runClient(implementation(command, "client"), "http://127.0.0.1")).rejects.toThrow(
      "Client adapter expected reported implementation other",
    );
  });

  it("includes the client adapter id when result output is invalid JSON", async () => {
    const command = [process.execPath, "-e", "console.log('not json')"];

    await expect(runClient(implementation(command, "client"), "http://127.0.0.1")).rejects.toThrow(
      "client adapter expected wrote invalid JSON while waiting for client result: not json",
    );
  });

  it("includes client stderr when the adapter exits after writing a result", async () => {
    const command = [
      process.execPath,
      "-e",
      [
        "console.log(JSON.stringify({",
        "type: 'result',",
        "implementation: 'expected',",
        "role: 'client',",
        "ok: true,",
        "status: 200,",
        "responseHeaders: {},",
        "responseBody: {}",
        "}));",
        "console.error('client post-result failed');",
        "process.exit(3);",
      ].join(""),
    ];

    await expect(runClient(implementation(command, "client"), "http://127.0.0.1")).rejects.toThrow(
      "Client adapter exited with code 3\nAdapter stderr:\nclient post-result failed",
    );
  });

  it("includes malformed client result payloads in the failure", async () => {
    const command = [
      process.execPath,
      "-e",
      [
        "console.log(JSON.stringify({",
        "type: 'ready',",
        "implementation: 'expected',",
        "role: 'server',",
        "port: 1234",
        "}));",
      ].join(""),
    ];

    await expect(runClient(implementation(command, "client"), "http://127.0.0.1")).rejects.toThrow(
      'Unexpected client result payload from expected: {"type":"ready","implementation":"expected","role":"server","port":1234}',
    );
  });

  it("rejects JSON stdout messages before client results", async () => {
    const command = [
      process.execPath,
      "-e",
      [
        "console.log(JSON.stringify({type: 'log', message: 'paying'}));",
        "console.log(JSON.stringify({",
        "type: 'result',",
        "implementation: 'expected',",
        "role: 'client',",
        "ok: true,",
        "status: 200,",
        "responseHeaders: {},",
        "responseBody: {}",
        "}));",
      ].join(""),
    ];

    await expect(runClient(implementation(command, "client"), "http://127.0.0.1")).rejects.toThrow(
      'Unexpected client result payload from expected: {"type":"log","message":"paying"}',
    );
  });
});
