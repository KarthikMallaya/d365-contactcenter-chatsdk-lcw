export {};

// Ensure Node-style globals exist in the browser for SDK dependencies.
declare global {
  // eslint-disable-next-line no-var
  var global: typeof globalThis | undefined;
}

if (typeof (globalThis as any).global === "undefined") {
  (globalThis as any).global = globalThis;
}

if (typeof (globalThis as any).process === "undefined") {
  (globalThis as any).process = { env: {} };
}
