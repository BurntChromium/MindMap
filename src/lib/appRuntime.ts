import { createIpcAppDataClient, setAppDataClient } from '$lib/appDataClient';

export function configureAppDataTransport() {
  if (typeof window === 'undefined' || !window.mindmapDesktop) {
    return false;
  }

  setAppDataClient(createIpcAppDataClient(window.mindmapDesktop));
  return true;
}
