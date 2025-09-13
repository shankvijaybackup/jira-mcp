import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { JiraClient } from './jiraClient.js';
import { nlqToJql, jqlForBugs, jqlForOpen, jqlForResolved } from './jqlBuilder.js';


const JIRA_BASE_URL = process.env.JIRA_BASE_URL!;
const JIRA_EMAIL = process.env.JIRA_EMAIL!;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN!;
const DEFAULT_PROJECT_KEY = process.env.DEFAULT_PROJECT_KEY || 'AW';


const jira = new JiraClient({ baseUrl: JIRA_BASE_URL, email: JIRA_EMAIL, apiToken: JIRA_API_TOKEN });


const server = new Server({
name: 'jira-mcp-tool',
version: '1.0.0',
}, {
capabilities: {
tools: {}
}
});


// tool: jira.stats
server.tool('jira.stats', {
description: 'Get bug stats for windows like 6m or 1y (open/resolved/bugs).',
inputSchema: {
type: 'object',
properties: {
projectKey: { type: 'string' },
kind: { type: 'string', enum: ['bugs-6m', 'resolved-1y', 'open-1y'] },
},
required: ['kind']
}
}, async (args) => {
const proj = (args.projectKey as string) || DEFAULT_PROJECT_KEY;
let jql = '';
if (args.kind === 'bugs-6m') jql = jqlForBugs(proj, '6m');
if (args.kind === 'resolved-1y') jql = jqlForResolved(proj, '1y');
if (args.kind === 'open-1y') jql = jqlForOpen(proj, '1y');
const total = await jira.count(jql);
return { content: [{ type: 'text', text: JSON.stringify({ projectKey: proj, kind: args.kind, total, jql }) }] };
});


// tool: jira.query (NLQ)
server.tool('jira.query', {
description: 'Ask in natural language; returns {jql,total,issues[...]}',
inputSchema: {
type: 'object',
properties: {
nlq: { type: 'string' },
projectKey: { type: 'string' },
limit: { type: 'number' }
},
required: ['nlq']
}
}, async (args) => {
const schema = z.object({ nlq: z.string(), projectKey: z.string().optional(), limit: z.number().int().min(1).max(100).optional() });
const { nlq, projectKey = DEFAULT_PROJECT_KEY, limit = 50 } = schema.parse(args);
const jql = nlqToJql(nlq, projectKey);
const result = await jira.search(jql, 0, limit);
return { content: [{ type: 'text', text: JSON.stringify({ projectKey, jql, total: result.total, issues: result.issues }) }] };
});


// tool: jira.jql (raw)
server.tool('jira.jql', {
description: 'Run raw JQL. Returns {total, issues}.',
inputSchema: {
type: 'object',
properties: { jql: { type: 'string' }, limit: { type: 'number' } },
required: ['jql']
}
}, async (args) => {
const schema = z.object({ jql: z.string(), limit: z.number().int().min(1).max(100).optional() });
const { jql, limit = 50 } = schema.parse(args);
const result = await jira.search(jql, 0, limit);
return { content: [{ type: 'text', text: JSON.stringify({ jql, total: result.total, issues: result.issues }) }] };
});


// stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);