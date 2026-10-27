import rawConfig from "./app.json" with { type: "json" };

function requiredString(value, key) {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(`config/app.json: ${key} must be a non-empty string`);
  }
  return value.trim();
}

function requiredPort(value, key) {
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new TypeError(`config/app.json: ports.${key} must be an integer from 1 to 65535`);
  }
  return value;
}

export const PRODUCT_NAME = requiredString(rawConfig.productName, "productName");

// Installer artifacts must stay shell- and URL-safe, so artifact names use a
// hyphenated form of the product name ("TWIST WHISPER" -> "TWIST-WHISPER").
// electron-builder and the packaging contract share this one rule so the
// contract can pin the exact artifact template.
export function artifactProductPrefix(name = PRODUCT_NAME) {
  return name.replace(/[^A-Za-z0-9]+/g, "-");
}
export const APP_ID = requiredString(rawConfig.appId, "appId");
export const DEFAULT_BACKEND_PORT = requiredPort(rawConfig.ports?.backend, "backend");
export const DEFAULT_WEB_PORT = requiredPort(rawConfig.ports?.web, "web");
export const DEFAULT_ELECTRON_DEV_PORT = requiredPort(rawConfig.ports?.electronDev, "electronDev");
export const DEFAULT_ELECTRON_PROXY_PORT = DEFAULT_ELECTRON_DEV_PORT + 1;

const configuredPorts = [DEFAULT_BACKEND_PORT, DEFAULT_WEB_PORT, DEFAULT_ELECTRON_DEV_PORT];
if (new Set(configuredPorts).size !== configuredPorts.length) {
  throw new TypeError("config/app.json: default ports must be distinct");
}
if (DEFAULT_ELECTRON_PROXY_PORT > 65535 || configuredPorts.includes(DEFAULT_ELECTRON_PROXY_PORT)) {
  throw new TypeError(
    "config/app.json: ports.electronDev + 1 is reserved for the private Electron proxy",
  );
}

export const APP_CONFIG = Object.freeze({
  productName: PRODUCT_NAME,
  appId: APP_ID,
  ports: Object.freeze({
    backend: DEFAULT_BACKEND_PORT,
    web: DEFAULT_WEB_PORT,
    electronDev: DEFAULT_ELECTRON_DEV_PORT,
  }),
});
