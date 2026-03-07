// MUST be imported before any @solana/web3.js import.
import "react-native-get-random-values";
import "react-native-url-polyfill/auto";
import { Buffer } from "@craftzdog/react-native-buffer";

const g = globalThis as typeof globalThis & {
  Buffer?: typeof Buffer;
  process?: {
    env: Record<string, string | undefined>;
    browser?: boolean;
    version?: string;
  };
  window?: typeof globalThis;
};

if (!g.Buffer) {
  g.Buffer = Buffer;
}

if (!g.process) {
  g.process = require("process");
}

if (!(g.process as any).env) {
  (g.process as any).env = {};
}

g.process.browser = true;
g.process.version = g.process.version ?? "v16.0.0";

if (!g.window) {
  g.window = g as any;
}

if (
  typeof g.TextEncoder === "undefined" ||
  typeof g.TextDecoder === "undefined"
) {
  const { TextEncoder, TextDecoder } = require("text-encoding");
  g.TextEncoder = TextEncoder;
  g.TextDecoder = TextDecoder as typeof globalThis.TextDecoder;
}
