declare global {
  var Buffer: typeof import("@craftzdog/react-native-buffer").Buffer;
  var process: {
    env: Record<string, string | undefined>;
    browser?: boolean;
    version?: string;
  };
  var window: typeof globalThis;
}

export {};
