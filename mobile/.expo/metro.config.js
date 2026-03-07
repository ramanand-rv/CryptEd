const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Add support for crypto modules
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  crypto: require.resolve("crypto-browserify"),
  stream: require.resolve("stream-browserify"),
  buffer: require.resolve("buffer"),
  process: require.resolve("process"),
  "react-native-get-random-values":
    require.resolve("react-native-get-random-values"),
};

// Ensure .cjs files are handled
config.resolver.sourceExts = [...config.resolver.sourceExts, "cjs"];

module.exports = config;
