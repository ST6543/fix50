const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite web: de wa-sqlite WASM-binary moet als asset gebundeld worden,
// anders faalt `expo export --platform web` op de import van wa-sqlite.wasm.
config.resolver.assetExts.push('wasm');

module.exports = config;
