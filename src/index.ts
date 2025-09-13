// --- env bootstrap (must be first)
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { z } from 'zod';
import { JiraClient } from './jiraClient.js';
import { jqlForBugs, jqlForResolved, jqlForOpen, nlqToJql } from './jqlBuilder.js';
import { buildJql } from './predefinedQueries';
import { promptToPredefined } from './nlPromptMap.js';

// read once from process.env
const {
  JIRA_BASE_URL,
  JIRA_EMAIL,
  JIRA_API_TOKEN,
  DEFAULT_PROJECT_KEY: ENV_DEFAULT_PROJECT_KEY,
  PORT: ENV_PORT,
} = process.env;

// turn Jira's bulky issue into a compact row for UX with selectable fields
function shapeIssue(i: any, baseUrl: string, select?: string[]) {
  const base = { 
    key: i.key, 
    url: `${baseUrl.replace(/\/$/, '')}/browse/${i.key}` 
  };
  
  if (!select || !select.length) {
    // default detail set
    return {
      ...base,
      summary: i.fields?.summary ?? '',
      status: i.fields?.status?.name ?? '',
      assignee: i.fields?.assignee?.displayName ?? null,
      reporter: i.fields?.reporter?.displayName ?? null,
      priority: i.fields?.priority?.name ?? null,
      created: i.fields?.created ?? null,
      resolutiondate: i.fields?.resolutiondate ?? null,
    };
  }
  
  const get: Record<string, (x: any) => any> = {
    key: (x) => x.key,
    url: (_) => base.url,
    summary: (x) => x.fields?.summary ?? '',
    status: (x) => x.fields?.status?.name ?? '',
    assignee: (x) => x.fields?.assignee?.displayName ?? null,
    reporter: (x) => x.fields?.reporter?.displayName ?? null,
    priority: (x) => x.fields?.priority?.name ?? null,
    created: (x) => x.fields?.created ?? null,
    resolutiondate: (x) => x.fields?.resolutiondate ?? null,
  };
  
  const out: any = {};
  for (const f of Array.from(new Set(['key', 'url', ...select]))) {
    if (get[f]) out[f] = get[f](i);
  }
  return out;
}

const DEFAULT_PROJECT_KEY = ENV_DEFAULT_PROJECT_KEY || 'ATOMICWORKPOC';
const PORT = parseInt(ENV_PORT || '8080', 10);

if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) {
  console.error('Missing required env: JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN');
  process.exit(1);
}


const jira = new JiraClient({ baseUrl: JIRA_BASE_URL, email: JIRA_EMAIL, apiToken: JIRA_API_TOKEN });
const app = express();
app.use(express.json());


// Health
app.get('/health', (_req, res) => res.json({ ok: true }));

// Summary of recent activity
app.get('/summary/recent-activity', async (req, res) => {
  try {
    const projectKey = (req.query.projectKey as string) || DEFAULT_PROJECT_KEY;
    const jql = `project = ${projectKey} ORDER BY updated DESC`;
    const { issues } = await jira.search(jql, 0, 5);
    
    const summary = issues.map(issue => ({
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status?.name,
      updated: issue.fields.updated,
      assignee: issue.fields.assignee?.displayName || 'Unassigned',
      url: `${JIRA_BASE_URL}/browse/${issue.key}`
    }));
    
    res.json({ projectKey, recentActivity: summary, jql });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Summary of open issues by status
app.get('/summary/open-issues', async (req, res) => {
  try {
    const projectKey = (req.query.projectKey as string) || DEFAULT_PROJECT_KEY;
    const jql = `project = ${projectKey} AND status not in (Done, Closed, Resolved) ORDER BY priority DESC, created`;
    const { issues, total } = await jira.search(jql, 0, 20);
    
    // Group by status
    const byStatus = issues.reduce((acc, issue) => {
      const status = issue.fields.status?.name || 'No Status';
      if (!acc[status]) {
        acc[status] = [];
      }
      acc[status].push({
        key: issue.key,
        summary: issue.fields.summary,
        priority: issue.fields.priority?.name || 'No Priority',
        assignee: issue.fields.assignee?.displayName || 'Unassigned',
        created: issue.fields.created,
        url: `${JIRA_BASE_URL}/browse/${issue.key}`
      });
      return acc;
    }, {} as Record<string, any[]>);
    
    res.json({ 
      projectKey, 
      totalOpen: total,
      byStatus,
      jql 
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});


// 1) Last 6 months total bugs
app.get('/stats/bugs-6m', async (req, res) => {
const projectKey = (req.query.projectKey as string) || DEFAULT_PROJECT_KEY;
const jql = jqlForBugs(projectKey, '6m');
const total = await jira.count(jql);
res.json({ projectKey, window: '6m', total, jql });
});


// 2) Last 1 year resolved bugs
app.get('/stats/resolved-1y', async (req, res) => {
const projectKey = (req.query.projectKey as string) || DEFAULT_PROJECT_KEY;
const jql = jqlForResolved(projectKey, '1y');
const total = await jira.count(jql);
res.json({ projectKey, window: '1y', total, jql });
});


// 3) Last 1 year open bugs
app.get('/stats/open-1y', async (req, res) => {
const projectKey = (req.query.projectKey as string) || DEFAULT_PROJECT_KEY;
const jql = jqlForOpen(projectKey, '1y');
const total = await jira.count(jql);
res.json({ projectKey, window: '1y', total, jql });
});


// 4) NLQ → JQL with results
app.post('/search/nlq', async (req, res) => {
const bodySchema = z.object({ nlq: z.string(), projectKey: z.string().optional(), limit: z.number().int().min(1).max(100).optional() });
const { nlq, projectKey = DEFAULT_PROJECT_KEY, limit = 50 } = bodySchema.parse(req.body);
const jql = nlqToJql(nlq, projectKey);
const { total, issues } = await jira.search(jql, 0, limit);
res.json({ projectKey, jql, total, issues });
});


// 5) Raw JQL passthrough (guarded)
app.post('/search/jql', async (req, res) => {
const bodySchema = z.object({ jql: z.string(), limit: z.number().int().min(1).max(100).optional() });
const { jql, limit = 50 } = bodySchema.parse(req.body);
const { total, issues } = await jira.search(jql, 0, limit);
res.json({ jql, total, issues });
});

// 6) Natural-language → JQL (count or rows)
app.post('/search/prompt', async (req, res) => {
  try {
    const bodySchema = z.object({
      prompt: z.string(),
      projectKey: z.string().optional(),
      countOnly: z.boolean().optional().default(false),
      startAt: z.number().int().min(0).optional().default(0),
      limit: z.number().int().min(1).max(100).optional().default(10),
      extras: z.record(z.string()).optional(),
      keysOnly: z.boolean().optional().default(false),
      includeDetails: z.boolean().optional().default(true),
      select: z.array(z.string()).optional(),     // allow caller to force columns
      format: z.enum(['json','text']).optional().default('json'),  // optional text output
    });
    const args = bodySchema.parse(req.body);

    const parsed = promptToPredefined(args.prompt);
    const pk = parsed?.projectKey || args.projectKey || DEFAULT_PROJECT_KEY;

    // Use NL prefs if present
    const limit = parsed?.out?.limit ?? args.limit;
    const keysOnly = parsed?.out?.keysOnly ?? args.keysOnly;
    const includeDetails = parsed?.out?.includeDetails ?? args.includeDetails;
    const select = args.select ?? parsed?.out?.select;
    const format = args.format;

    // JQL from predefined, else fallback
    const jql = parsed
      ? buildJql(parsed.name, { projectKey: pk, ...(parsed.extras || {}), ...(args.extras || {}) }).jql
      : nlqToJql(args.prompt, pk);

    if (args.countOnly) {
      const total = await jira.count(jql);
      return res.json({ prompt: args.prompt, matchedName: parsed?.name ?? null, jql, total, startAt: args.startAt, limit });
    }

    const { total, issues } = await jira.search(jql, args.startAt, limit);

    if (keysOnly) {
      return res.json({
        prompt: args.prompt, matchedName: parsed?.name ?? null, jql, total, startAt: args.startAt, limit,
        keys: issues.map(i => i.key),
      });
    }

    // JSON (column-shaped) or a pretty text block:
    const shaped = issues.map(i => shapeIssue(i, JIRA_BASE_URL!, select));

    if (format === 'text') {
      const label = (k: string) => ({
        key: 'ID', url: 'URL', summary: 'Summary', status: 'Status',
        reporter: 'Reporter', assignee: 'Assignee', priority: 'Priority',
        created: 'Created', resolutiondate: 'Resolved'
      }[k] || k);

      const cols = (select && select.length) ? Array.from(new Set(['key','url', ...select])) : ['key','url','summary','status','reporter'];
      const text = shaped.map(row =>
        cols.map(c => `${label(c)}: ${row[c] ?? ''}`).join('\n')
      ).join('\n\n');
      return res.json({ prompt: args.prompt, matchedName: parsed?.name ?? null, jql, total, startAt: args.startAt, limit, text });
    }

    return res.json({
      prompt: args.prompt, matchedName: parsed?.name ?? null, jql, total, startAt: args.startAt, limit,
      columns: select && select.length ? Array.from(new Set(['key','url', ...select])) : undefined,
      issues: shaped,
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || String(err) });
  }
});

// 7) Note-ready version for Atomicwork tickets
app.post('/note/prompt', async (req, res) => {
  try {
    const bodySchema = z.object({ prompt: z.string(), projectKey: z.string().optional() });
    const { prompt, projectKey } = bodySchema.parse(req.body);

    const parsed = promptToPredefined(prompt);
    const pk = parsed?.projectKey || projectKey || DEFAULT_PROJECT_KEY;
    const jql = parsed ? buildJql(parsed.name, { projectKey: pk, ...parsed.extras }).jql
                       : nlqToJql(prompt, pk);

    const total = await jira.count(jql);
    const note = `${prompt}: ${total} (JQL: ${jql})`;
    return res.json({ note, prompt, jql, total });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || String(err) });
  }
});

// --- helpers to format summary lines
function clean(s?: string | null, fallback = '—'): string {
  return (s ?? '').toString().trim() || fallback;
}

function issueLine(i: any): string {
  const key = i.key;
  const st = clean(i.fields?.status?.name, '—');
  const rep = clean(i.fields?.reporter?.displayName, 'Unknown');
  const asg = clean(i.fields?.assignee?.displayName, 'Unassigned');
  return `${key} · ${st} — Reporter: ${rep} · Assignee: ${asg}`;
}

// SUMMARY: NL prompt → JQL → count + Top N keys (and details).
// Robust behavior for "recently resolved": detect intent by prompt text OR parsed name,
// try resolutiondate, then Done, then widen to 30d.
app.post('/summary/prompt', async (req, res) => {
  try {
    const bodySchema = z.object({
      prompt: z.string(),
      projectKey: z.string().optional(),
      top: z.number().int().min(1).max(50).optional().default(3),
      includeDetails: z.boolean().optional().default(false),
      windowDays: z.number().int().min(1).max(365).optional(), // explicit override
    });
    const { prompt, projectKey, top, includeDetails, windowDays } = bodySchema.parse(req.body);

    const parsed = promptToPredefined(prompt);
    const pk = parsed?.projectKey || projectKey || DEFAULT_PROJECT_KEY;

    // Build initial JQL (predefined if matched; otherwise fallback NLQ)
    let jql = parsed
      ? buildJql(parsed.name, { projectKey: pk, ...(parsed.extras || {}) }).jql
      : nlqToJql(prompt, pk);

    // Detect "recently resolved" intent even if predefined matching failed
    const recentResolvedIntent =
      (parsed?.name === 'recently_resolved_issues_14d') ||
      /\b(recent|recently)\s+(resolved|closed|fixed)\s+(issues|tickets|bugs)\b/i.test(prompt) ||
      /\brecently\s+(resolved|closed|fixed)\b/i.test(prompt);

    // Allow caller override of days (only affects the resolved version)
    if (windowDays && recentResolvedIntent) {
      jql = jql.replace(/-\d+d\b/, `-${windowDays}d`);
    }

    // 1) Try the initial JQL
    let usedJql = jql;
    let { total, issues } = await jira.search(usedJql, 0, top);
    let noteSuffix = '';

    // 2) If this is a "recently resolved" ask and there are no results, try statusCategory=Done
    if (recentResolvedIntent && total === 0 && !windowDays) {
      const done14 = `project = ${pk} AND statusCategory = Done AND updated >= -14d ORDER BY updated DESC`;
      const r1 = await jira.search(done14, 0, top);
      if (r1.total > 0) {
        total = r1.total;
        issues = r1.issues;
        usedJql = done14;
        noteSuffix = ' (no resolved in last 14d; showing items moved to Done in last 14d)';
      } else {
        // 3) Widen to 30 days: resolutiondate first
        const res30 = jql.replace(/-14d\b/, '-30d');
        const r2 = await jira.search(res30, 0, top);
        if (r2.total > 0) {
          total = r2.total;
          issues = r2.issues;
          usedJql = res30;
          noteSuffix = ' (no matches in last 14d; showing last 30d)';
        } else {
          // 4) Widen to 30 days for Done
          const done30 = `project = ${pk} AND statusCategory = Done AND updated >= -30d ORDER BY updated DESC`;
          const r3 = await jira.search(done30, 0, top);
          if (r3.total > 0) {
            total = r3.total;
            issues = r3.issues;
            usedJql = done30;
            noteSuffix = ' (no resolved in last 14d; showing items moved to Done in last 30d)';
          }
        }
      }
    }

    // Build summary text
    const line = (i: any) => {
      const st = (i.fields?.status?.name ?? '—').trim() || '—';
      const rep = (i.fields?.reporter?.displayName ?? 'Unknown').trim() || 'Unknown';
      const asg = (i.fields?.assignee?.displayName ?? 'Unassigned').trim() || 'Unassigned';
      return `${i.key} · ${st} — Reporter: ${rep} · Assignee: ${asg}`;
    };

    let summary = `${prompt} = ${total}${noteSuffix}`;
    if (issues.length) {
      summary += includeDetails
        ? `\nTop ${issues.length}:\n${issues.map(line).join('\n')}`
        : `\nTop ${issues.length}:\n${issues.map((i) => i.key).join('\n')}`;
    }

    return res.json({ summary, prompt, jql: usedJql, total, top: issues.map((i) => i.key) });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || String(err) });
  }
});

// SUMMARY: single issue blurb (CRM-1 → one line)
app.post('/summary/issue', async (req, res) => {
  try {
    const bodySchema = z.object({ key: z.string() });
    const { key } = bodySchema.parse(req.body);
    const issue = await jira.issue(key);

    const st = clean(issue.fields?.status?.name, '—');
    const rep = clean(issue.fields?.reporter?.displayName, 'Unknown');
    const asg = clean(issue.fields?.assignee?.displayName, 'Unassigned');
    const sum = clean(issue.fields?.summary, '');
    const blurb = `${key} · ${st} — Reporter: ${rep} · Assignee: ${asg}${sum ? ` · "${sum}"` : ''}`;

    return res.json({ blurb, key, status: st, reporter: rep, assignee: asg, summary: sum });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || String(err) });
  }
});

app.listen(PORT, () => console.log(`HTTP listening on :${PORT}`));