import { appDataClient } from '$lib/appDataClient';
import type { AppDataPageData } from '$lib/server/appData';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
	return (await appDataClient.loadInitialPageData(fetch)) as AppDataPageData;
};
