import { json } from '@sveltejs/kit';
import { getInitialPageData } from '$lib/server/appData';

export function GET() {
  return json(getInitialPageData());
}
