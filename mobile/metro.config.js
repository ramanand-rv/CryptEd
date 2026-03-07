const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  crypto: require.resolve("crypto-browserify"),
  stream: require.resolve("stream-browserify"),
  buffer: require.resolve("buffer"),
  process: require.resolve("process"),
};

config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionsByPlatform = {
  ...config.resolver.unstable_conditionsByPlatform,
  ios: [...(config.resolver.unstable_conditionsByPlatform?.ios ?? []), "browser"],
  android: [...(config.resolver.unstable_conditionsByPlatform?.android ?? []), "browser"],
};

module.exports = config;
