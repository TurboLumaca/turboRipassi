module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      [
        "module-resolver",
        {
          alias: { "@": "./src" },
          extensions: [".ts", ".tsx", ".js", ".jsx", ".json"]
        }
      ],
      // react-native-worklets richiede questo plugin per ultimo (serve a
      // react-native-live-markdown per il grassetto/corsivo live nel form).
      "react-native-worklets/plugin"
    ]
  };
};
