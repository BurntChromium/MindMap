import { getInitialPageData } from '$lib/server/graphData';

export function load() {
  return getInitialPageData();
}
