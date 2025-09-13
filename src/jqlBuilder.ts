// src/jqlBuilder.ts
import { subMonths, subYears, formatISO } from 'date-fns';

export type TimeWindow = '6m' | '12m' | '1y' | '90d' | '30d' | 'all';

export const nowISO = () => formatISO(new Date());

export function fromWindow(win: TimeWindow): string | null {
  const now = new Date();
  if (win === '6m') return formatISO(subMonths(now, 6));
  if (win === '12m' || win === '1y') return formatISO(subYears(now, 1));
  if (win === '90d') return formatISO(subMonths(now, 3));
  if (win === '30d') return formatISO(subMonths(now, 1));
  return null; // 'all'
}

export function jqlForBugs(projectKey: string, win: TimeWindow = '6m'): string {
  const from = fromWindow(win);
  const timeClause = from ? ` AND created >= "${from}"` : '';
  return `project = ${projectKey} AND issuetype = Bug${timeClause}`;
}

export function jqlForResolved(projectKey: string, win: TimeWindow = '1y'): string {
  const from = fromWindow(win);
  const timeClause = from ? ` AND resolved >= "${from}"` : '';
  return `project = ${projectKey} AND resolutiondate IS NOT EMPTY${timeClause}`;
}

export function jqlForOpen(projectKey: string, win: TimeWindow = '1y'): string {
  const from = fromWindow(win);
  const timeClause = from ? ` AND created >= "${from}"` : '';
  return `project = ${projectKey} AND statusCategory != Done${timeClause}`;
}

// Minimal NL → JQL mapping for common asks;
// you can extend this later with more phrases.
export function nlqToJql(nlq: string, projectKey: string): string {
  const q = nlq.toLowerCase();

  if (q.includes('last 6 months') && q.includes('bug')) {
    return jqlForBugs(projectKey, '6m');
  }
  if ((q.includes('last 1 year') || q.includes('last year') || q.includes('last 12 months')) &&
      (q.includes('resolved') || q.includes('closed'))) {
    return jqlForResolved(projectKey, '1y');
  }
  if (q.includes('open bugs') || (q.includes('bugs') && q.includes('open'))) {
    return jqlForOpen(projectKey, '1y');
  }

  // Fallback
  return `project = ${projectKey}`;
}
