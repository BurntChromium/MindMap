export function configureAppDataTransport() {
  if (typeof window === 'undefined' || !window.__TAURI__) {
    return false;
  }

  return true;
}
