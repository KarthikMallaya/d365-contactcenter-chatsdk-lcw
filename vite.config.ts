import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const adapterEntry = path.resolve(
  __dirname,
  "node_modules/@microsoft/botframework-webchat-adapter-azure-communication-chat/dist-esm/src/index.js"
);
const adapterPackageJson = path.resolve(
  __dirname,
  "node_modules/@microsoft/botframework-webchat-adapter-azure-communication-chat/package.json"
);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: "@microsoft/botframework-webchat-adapter-azure-communication-chat/package.json", replacement: adapterPackageJson },
      { find: "@microsoft/botframework-webchat-adapter-azure-communication-chat", replacement: adapterEntry },
      { find: "react-native", replacement: path.resolve(__dirname, "src/react-native-shim.js") }
    ]
  },
  optimizeDeps: {
    exclude: ["react-native"]
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true
    }
  }
});
