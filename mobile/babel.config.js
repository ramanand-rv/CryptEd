module.exports = {
  presets: ["babel-preset-expo"],
  plugins: [
    [
      "module-resolver",
      {
        root: ["./"],
        alias: {
          crypto: "crypto-browserify",
          stream: "stream-browserify",
          buffer: "buffer",
          process: "process",
        },
      },
    ],
  ],
};
