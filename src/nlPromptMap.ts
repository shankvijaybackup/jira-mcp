import { PredefinedName } from './predefinedQueries.js';

export type PromptParsed = {
  name: PredefinedName;
  extras?: Record<string, string>;
  projectKey?: string;
  out?: { keysOnly?: boolean; includeDetails?: boolean; limit?: number; select?: string[] };
};

function normalize(raw: string) {
  const cleaned = raw
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .replace(/[^\w\s\-\.":]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const lower = cleaned
    .toLowerCase()
    .replace(/\b(please|pls|could you|can you|show me|tell me|give me|list|display|find|what are|what's|whats)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return { raw: cleaned, lower };
}

const projectAliases: Record<string,string> = { 
  crm: 'CRM',
  'customer portal': 'CRM', 
  aw: 'AW', 
  atomicwork: 'AW' 
};

function extractProjectKey(raw: string, lower: string): string | undefined {
  // "in project CRM" | "in CRM" | "for CRM"
  const explicit = raw.match(/\b(?:in|for)\s+project\s+([A-Z][A-Z0-9_]+)\b/) || 
                  raw.match(/\b(?:in|for)\s+([A-Z][A-Z0-9_]+)\b/);
  if (explicit?.[1]) return explicit[1];
  
  // Check for aliases like "in crm" or "for customer portal"
  const aliasPhrase = lower.match(/\b(?:in|for)\s+([a-z][a-z0-9 _-]+)\b/);
  const maybe = aliasPhrase?.[1]?.trim();
  if (maybe && projectAliases[maybe]) return projectAliases[maybe];
  
  // Check for standalone aliases
  for (const k of Object.keys(projectAliases)) {
    if (lower === k || 
        lower.startsWith(k + ' ') || 
        lower.endsWith(' ' + k) || 
        lower.includes(' ' + k + ' ')) {
      return projectAliases[k];
    }
  }
  return undefined;
}

function extractExtrasAndOutput(raw: string, lower: string) {
  // Extract component, version, etc.
  const comp = raw.match(/component\s+"?([A-Za-z0-9 _-]+)"?/i)?.[1];
  const issueKey = raw.match(/([A-Z][A-Z0-9]+-\d{1,6})/)?.[1];
  const version = raw.match(/version\s+"?([A-Za-z0-9._-]+)"?/i)?.[1];
  const envMatch = raw.match(/\b(iOS|Android|Windows|macOS|Linux)\b/i);
  const envTerm = envMatch ? envMatch[1] : undefined;
  const linkTypeMatch = raw.match(/"([^"]+)"\s*$/);
  const linkType = linkTypeMatch?.[1]?.toLowerCase() === "is blocked by" ? "is blocked by" : undefined;

  // Handle output field selection
  const select: string[] = [];
  
  // Standard field extraction
  if (/\b(ids?|keys?|issue\s*keys?)\b/i.test(raw)) select.push('key');
  if (/\breporters?\b/i.test(raw)) select.push('reporter');
  if (/\bassignees?\b/i.test(raw)) select.push('assignee');
  if (/\bstatus(es)?\b/i.test(raw)) select.push('status');
  if (/\b(summary|title)\b/i.test(raw)) select.push('summary');
  if (/\bpriorit(y|ies)\b/i.test(raw)) select.push('priority');
  
  // Date field extraction with more flexible matching
  if (/(?:^|\s)(created|create|submitted|submit)(?:\s+\w+){0,3}\s+(date|on|since|from)\b/i.test(lower) || 
      /\b(?:created|create|submitted|submit)\s+date\b/i.test(lower)) {
    select.push('created');
  }
  
  if (/(?:^|\s)(resolution|resolved|closed|fixed)(?:\s+\w+){0,3}\s+(date|on|since|from)\b/i.test(lower) || 
      /\b(resolution|resolved|closed|fixed)\s+date\b/i.test(lower)) {
    select.push('resolutiondate');
  }
  
  // Additional field mappings
  if (/(?:^|\s)(updated|modified|changed)(?:\s+\w+){0,3}\s+(date|on|since|from)\b/i.test(lower)) {
    select.push('updated');
  }
  
  // If no specific fields were requested but we have a project key, include key and summary by default
  if (select.length === 0 && raw.match(/[A-Z][A-Z0-9_]+/)) {
    select.push('key', 'summary');
  }

  const out: { keysOnly?: boolean; includeDetails?: boolean; limit?: number; select?: string[] } = {};
  
  // If specific fields were requested, include details
  if (select.length) { 
    out.includeDetails = true; 
    out.select = Array.from(new Set(select)); 
  }
  
  // Handle "keys only" requests
  if (/\b(keys?|ids?)\s+only\b/i.test(raw) || /\bonly\s+(keys?|ids?)\b/i.test(raw)) { 
    out.keysOnly = true; 
    out.includeDetails = false; 
    out.select = ['key']; 
  }
  
  // Handle top/limit
  const topM = lower.match(/\btop\s+(\d{1,3})\b/); 
  const limM = lower.match(/\blimit\s+(\d{1,3})\b/);
  const n = topM ? parseInt(topM[1],10) : limM ? parseInt(limM[1],10) : undefined;
  if (n) out.limit = Math.min(Math.max(n,1),100);

  return { comp, issueKey, version, envTerm, linkType, out };
}

export function promptToPredefined(prompt: string): { 
  name: PredefinedName; 
  extras?: Record<string, string>; 
  projectKey?: string; 
  out?: any 
} | null {
  const { raw, lower } = normalize(prompt);
  const projectKey = extractProjectKey(raw, lower);
  const { comp, issueKey, version, envTerm, linkType, out } = extractExtrasAndOutput(raw, lower);

  const BUG = /(bug|defect|issue|ticket)s?/i;
  const OPEN = /(open|unresolved|not\s+closed|not\s+done)/i;
  const RESOLVED = /(resolved|closed|fixed)/i;

  const rules: Array<[RegExp, PredefinedName, (e: any) => any]> = [
    // Recently resolved (14d)
    [/\b(recent|recently)\s+resolved\s+(issues?|tickets?|bugs?)\b/i, 'recently_resolved_issues_14d', e => e],

    // Resolved (no time window) - tolerate words in between
    [/\b(resolved|closed|fixed)\b.*\b(bugs?|issues?|tickets?)\b/i, 'resolved_bugs_anytime', e => e],
    
    // Totals windows
    [/total\s+bugs?.*last\s+6\s*months|last\s+six\s*months/i, 'bugs_created_last_6_months', e => e],
    [/bugs?\s+resolved.*last\s+12\s*months|last\s+year/i, 'bugs_resolved_last_12_months', e => e],
    
    // Keep the original specific patterns for backward compatibility
    [new RegExp(`^${RESOLVED.source}\\s+${BUG.source}`), 'resolved_bugs_anytime', e => e],
    [new RegExp(`${RESOLVED.source}\\s+${BUG.source}\\s+in\\b`), 'resolved_bugs_anytime', e => e],

    // Issues (not just bugs)
    [/^all\s+issues\b/i, 'all_issues_in_project', e => e],
    [/\b(all\s+)?open\s+(issues|tickets)\s+(in|for)\b/i, 'open_issues_in_project', e => e],
    [/\b(all\s+)?open\s+(issues|tickets)\b/i, 'open_issues_any_project', e => e],

    // Open bugs - flexible matching with words in between and regardless of order
    [new RegExp(`(?:${OPEN.source}).*?(?:${BUG.source})|(?:${BUG.source}).*?(?:${OPEN.source})`, 'i'), 'open_bugs_in_project', e => e],
    
    // More specific open bugs patterns
    [/open\s+bugs?\s+by\s+priority/i, 'open_bugs_by_priority', e => e],
    [new RegExp(`^${OPEN.source}\\s+${BUG.source}`), 'open_bugs_any_project', e => e],
    [new RegExp(`${OPEN.source}\\s+${BUG.source}\\s+in\\b`), 'open_bugs_in_project', e => e],
    [new RegExp(`${BUG.source}.*${OPEN.source}`), 'open_bugs_any_project', e => e],
    [/all\s+open\s+bugs\b|open\s+bugs\s+right\s+now/i, 'open_bugs_any_project', e => e],
    [/^open\s+bugs\b/i, 'open_bugs_any_project', e => e],

    // This week (keep this specific time-based pattern)
    [/\b(resolved|closed|fixed)\s+bugs?\s+(this|current)\s+week\b/i, 'resolved_bugs_this_week', e => e],

    // Other predefined queries
    [/unassigned\s+open\s+bugs/i, 'unassigned_open_bugs', e => e],
    [/my\s+open\s+bugs/i, 'my_open_bugs', e => e],
    [/(critical|blocker).*(open\s+)?bugs/i, 'critical_blocker_open_bugs', e => e],
    [/bugs\s+created\s+last\s+week/i, 'bugs_created_last_week', e => e],
    [/bugs\s+resolved\s+last\s+week/i, 'bugs_resolved_last_week', e => e],
    [/new\s+bugs\s+today|today's\s+bugs/i, 'new_bugs_today', e => e],
    [/resolved\s+(in\s+)?last\s+24\s*hours/i, 'bugs_resolved_last_24h', e => e],
    [/stale\s+open\s+bugs|no\s+updates\s+in\s+14\s*days/i, 'stale_open_bugs_14d', e => e],
    [/aging.*oldest\s+open\s+bugs|oldest\s+open\s+bugs/i, 'aging_oldest_open_bugs', e => e],
    [/regression\s+bugs.*last\s+30\s*days/i, 'regression_bugs_last_30d', e => e],
    [/open\s+bugs.*component/i, 'open_bugs_for_component', e => ({ ...e, component: comp })],
    [/targeted\s+for\s+the\s+next\s+version|earliest\s+unreleased\s+version/i, 'bugs_targeted_next_unreleased_version', e => e],
    [/unreleased\s+versions/i, 'bugs_in_unreleased_versions', e => e],
    [/affecting\s+version/i, 'bugs_affecting_version', e => ({ ...e, version })],
    [/open\s+sprints?/i, 'bugs_in_open_sprints', e => e],
    [/reopened\s+bugs.*last\s+30\s*days/i, 'reopened_bugs_last_30d', e => e],
    [/no\s+explicit\s+reopened|without\s+reopened\s+step/i, 'reopened_without_reopened_step_30d', e => e],
    [/duplicates?.*last\s+90\s*days/i, 'duplicates_last_90d', e => e],
    [/no\s+fix\s+version|without\s+fix\s+version/i, 'bugs_no_fix_version', e => e],
    [/linked\s+to\s+[A-Z][A-Z0-9]+-\d+\s*,?\s*"is blocked by"/i, 'bugs_linked_to_issue', e => ({ ...e, issueKey, linkType: 'is blocked by' })],
    [/linked\s+to\s+[A-Z][A-Z0-9]+-\d+/i, 'bugs_linked_to_issue', e => ({ ...e, issueKey })],
    [/(environment|env).*\b(iOS|Android|Windows|macOS|Linux)\b/i, 'open_bugs_env_contains', e => ({ ...e, envTerm })]
  ];

  for (const [re, name, x] of rules) {
    if (re.test(lower)) {
      const extras: any = x({});
      if (extras.component === undefined && comp) extras.component = comp;
      if (extras.version === undefined && version) extras.version = version;
      if (extras.issueKey === undefined && issueKey) extras.issueKey = issueKey;
      if (extras.envTerm === undefined && envTerm) extras.envTerm = envTerm;
      if (extras.linkType === undefined && linkType) extras.linkType = linkType;
      return { name, extras, projectKey, out };
    }
  }
  return null;
}
