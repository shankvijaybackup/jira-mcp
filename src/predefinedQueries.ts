import { z } from 'zod';

type JqlString = string;

type PredefinedQuery = {
  description: string;
  jql: (params: Record<string, any>) => string;
  params: z.ZodObject<any>;
};

export const PREDEFINED_QUERIES: Record<string, PredefinedQuery> = {
  'bugs_created_last_6_months': {
    description: 'Bugs created in the last 6 months',
    jql: () => 'issuetype = Bug AND created >= -6m ORDER BY created DESC',
    params: z.object({})
  },
  'bugs_resolved_last_12_months': {
    description: 'Bugs resolved in the last 12 months',
    jql: () => 'issuetype = Bug AND resolutiondate >= -12m ORDER BY resolutiondate DESC',
    params: z.object({})
  },
  'open_bugs_in_project': {
    description: 'Open bugs in project',
    jql: () => 'issuetype = Bug AND status not in (Done, Closed, Resolved) ORDER BY created DESC',
    params: z.object({})
  },
  'open_bugs_any_project': {
    description: 'Open bugs in any project',
    jql: () => 'issuetype = Bug AND status not in (Done, Closed, Resolved) ORDER BY created DESC',
    params: z.object({})
  },
  'unassigned_open_bugs': {
    description: 'Unassigned open bugs',
    jql: () => 'issuetype = Bug AND assignee is EMPTY AND status not in (Done, Closed, Resolved) ORDER BY created DESC',
    params: z.object({})
  },
  'my_open_bugs': {
    description: 'My open bugs',
    jql: () => 'issuetype = Bug AND assignee = currentUser() AND status not in (Done, Closed, Resolved) ORDER BY updated DESC',
    params: z.object({})
  },
  'critical_blocker_open_bugs': {
    description: 'Critical/Blocker open bugs',
    jql: () => 'issuetype = Bug AND priority in (Critical, Blocker) AND status not in (Done, Closed, Resolved) ORDER BY created DESC',
    params: z.object({})
  },
  'bugs_created_last_week': {
    description: 'Bugs created in the last week',
    jql: () => 'issuetype = Bug AND created >= -1w ORDER BY created DESC',
    params: z.object({})
  },
  'bugs_resolved_last_week': {
    description: 'Bugs resolved in the last week',
    jql: () => 'issuetype = Bug AND resolutiondate >= -1w ORDER BY resolutiondate DESC',
    params: z.object({})
  },
  'new_bugs_today': {
    description: 'New bugs created today',
    jql: () => 'issuetype = Bug AND created >= startOfDay() ORDER BY created DESC',
    params: z.object({})
  },
  'bugs_resolved_last_24h': {
    description: 'Bugs resolved in the last 24 hours',
    jql: () => 'issuetype = Bug AND resolutiondate >= -24h ORDER BY resolutiondate DESC',
    params: z.object({})
  },
  'stale_open_bugs_14d': {
    description: 'Stale open bugs (no updates in 14 days)',
    jql: () => 'issuetype = Bug AND status not in (Done, Closed, Resolved) AND updated <= -14d ORDER BY updated ASC',
    params: z.object({})
  },
  'aging_oldest_open_bugs': {
    description: 'Oldest open bugs',
    jql: () => 'issuetype = Bug AND status not in (Done, Closed, Resolved) ORDER BY created ASC',
    params: z.object({})
  },
  'regression_bugs_last_30d': {
    description: 'Regression bugs in the last 30 days',
    jql: () => 'issuetype = Bug AND labels = regression AND created >= -30d ORDER BY created DESC',
    params: z.object({})
  },
  'open_bugs_for_component': {
    description: 'Open bugs for a specific component',
    jql: (params: { component?: string }) => 
      `issuetype = Bug AND component = "${params.component || ''}" AND status not in (Done, Closed, Resolved) ORDER BY created DESC`,
    params: z.object({
      component: z.string().optional()
    })
  },
  'bugs_in_unreleased_versions': {
    description: 'Bugs in unreleased versions',
    jql: () => 'issuetype = Bug AND fixVersion in unreleasedVersions() ORDER BY created DESC',
    params: z.object({})
  },
  'bugs_affecting_version': {
    description: 'Bugs affecting a specific version',
    jql: (params: { version?: string }) => 
      `issuetype = Bug AND affectedVersion = "${params.version || ''}" ORDER BY created DESC`,
    params: z.object({
      version: z.string().optional()
    })
  },
  'bugs_in_open_sprints': {
    description: 'Bugs in open sprints',
    jql: () => 'issuetype = Bug AND sprint in openSprints() ORDER BY created DESC',
    params: z.object({})
  },
  'reopened_bugs_last_30d': {
    description: 'Reopened bugs in the last 30 days',
    jql: () => 'issuetype = Bug AND status changed TO "Reopened" DURING (-30d, now()) ORDER BY updated DESC',
    params: z.object({})
  },
  'duplicates_last_90d': {
    description: 'Duplicate bugs in the last 90 days',
    jql: () => 'issuetype = Bug AND status = Duplicate AND created >= -90d ORDER BY created DESC',
    params: z.object({})
  },
  'bugs_no_fix_version': {
    description: 'Bugs without a fix version',
    jql: () => 'issuetype = Bug AND fixVersion is EMPTY ORDER BY created DESC',
    params: z.object({})
  },
  'bugs_linked_to_issue': {
    description: 'Bugs linked to a specific issue',
    jql: (params: { issueKey?: string }) => 
      `issuetype = Bug AND issue in linkedIssues(${params.issueKey || 'null'})`,
    params: z.object({
      issueKey: z.string().optional()
    })
  },
  'all_issues_in_project': {
    description: 'All issues in project',
    jql: () => 'ORDER BY created DESC',
    params: z.object({})
  },
  'recently_resolved_issues_14d': {
    description: 'Issues resolved in the last 14 days',
    jql: () => 'resolutiondate >= -14d ORDER BY resolutiondate DESC',
    params: z.object({})
  },
  'open_bugs_by_priority': {
    description: 'Open bugs grouped by priority',
    jql: () => 'issuetype = Bug AND status not in (Done, Closed, Resolved) ORDER BY priority DESC, created',
    params: z.object({})
  },
  'bugs_targeted_next_unreleased_version': {
    description: 'Bugs targeted for next unreleased version',
    jql: () => 'issuetype = Bug AND fixVersion in unreleasedVersions() ORDER BY priority DESC, created',
    params: z.object({})
  },
  'reopened_without_reopened_step_30d': {
    description: 'Bugs reopened without a Reopened status in the last 30 days',
    jql: () => 'issuetype = Bug AND status was not in (Done, Closed, Resolved) DURING (-30d, now()) AND status was in (Done, Closed, Resolved) DURING (-30d, now())',
    params: z.object({})
  },
  'open_bugs_env_contains': {
    description: 'Open bugs with environment containing text',
    jql: (params: { text?: string }) => 
      `issuetype = Bug AND status not in (Done, Closed, Resolved) AND environment ~ "${params.text || ''}"`,
    params: z.object({
      text: z.string().optional()
    })
  },
  'recently_done_issues_14d': {
    description: 'Issues marked as done in the last 14 days',
    jql: () => 'statusCategory = Done AND updated >= -14d ORDER BY updated DESC',
    params: z.object({})
  },
  'resolved_bugs_anytime': {
    description: 'All resolved bugs (anytime)',
    jql: () => 'issuetype = Bug AND (resolution IS NOT EMPTY OR statusCategory = Done) ORDER BY resolutiondate DESC, updated DESC',
    params: z.object({})
  }
} as const;

export type PredefinedName = keyof typeof PREDEFINED_QUERIES;

type QueryParams = {
  [K in PredefinedName]: z.infer<typeof PREDEFINED_QUERIES[K]['params']>;
};

type BuildJqlResult = {
  name: string;
  jql: string;
  params: Record<string, unknown>;
};

export function buildJql(
  queryName: PredefinedName,
  params: QueryParams[PredefinedName] & { projectKey?: string } = {}
): BuildJqlResult {
  const query = PREDEFINED_QUERIES[queryName];
  if (!query) {
    throw new Error(`Unknown query: ${queryName}`);
  }

  // Handle special cases with custom JQL generation
  switch (queryName) {
    case 'all_issues_in_project':
      if (!params.projectKey) throw new Error('projectKey is required');
      return { 
        name: queryName, 
        jql: `project = ${params.projectKey} ORDER BY created DESC`,
        params: {}
      };
      
    case 'recently_done_issues_14d':
      if (!params.projectKey) throw new Error('projectKey is required');
      return {
        name: queryName,
        jql: `project = ${params.projectKey} AND statusCategory = Done AND updated >= -14d ORDER BY updated DESC`,
        params: {}
      };
      
    case 'recently_resolved_issues_14d':
      if (!params.projectKey) throw new Error('projectKey is required');
      return { 
        name: queryName, 
        jql: `project = ${params.projectKey} AND resolutiondate >= -14d ORDER BY resolutiondate DESC`,
        params: {}
      };
      
    case 'resolved_bugs_anytime': {
      // robust: either a resolution was set OR issue moved to a Done category
      const core = `issuetype = Bug AND (resolution IS NOT EMPTY OR statusCategory = Done) ORDER BY resolutiondate DESC, updated DESC`;
      return { 
        name: queryName, 
        jql: params.projectKey ? `project = ${params.projectKey} AND ${core}` : core,
        params: {}
      };
    }
      
    case 'open_bugs_by_priority':
      return { 
        name: queryName,
        jql: `issuetype = Bug AND statusCategory != Done ORDER BY priority DESC, created DESC`,
        params: {}
      };

    case 'bugs_created_last_week':
      return { 
        name: queryName,
        jql: `issuetype = Bug AND created >= startOfWeek(-1) AND created < startOfWeek()`,
        params: {}
      };

    case 'bugs_resolved_last_week':
      return { 
        name: queryName,
        jql: `issuetype = Bug AND resolutiondate >= startOfWeek(-1) AND resolutiondate < startOfWeek()`,
        params: {}
      };

    case 'new_bugs_today':
      return { 
        name: queryName,
        jql: `issuetype = Bug AND created >= startOfDay()`,
        params: {}
      };

    case 'bugs_resolved_last_24h':
      return { 
        name: queryName,
        jql: `issuetype = Bug AND resolutiondate >= -1d`,
        params: {}
      };

    case 'stale_open_bugs_14d':
      return { 
        name: queryName,
        jql: `issuetype = Bug AND statusCategory != Done AND updated <= -14d`,
        params: {}
      };

    case 'aging_oldest_open_bugs':
      return { 
        name: queryName,
        jql: `issuetype = Bug AND statusCategory != Done ORDER BY created ASC`,
        params: {}
      };

    case 'regression_bugs_last_30d': {
      const label = (params as any).label || 'regression';
      return { 
        name: queryName,
        jql: `issuetype = Bug AND labels = ${JSON.stringify(label)} AND created >= -30d`,
        params: { label }
      };
    }

    case 'open_bugs_for_component': {
      if (!(params as any).component) throw new Error('component is required');
      return { 
        name: queryName,
        jql: `issuetype = Bug AND component = ${JSON.stringify((params as any).component)} AND statusCategory != Done`,
        params: { component: (params as any).component }
      };
    }

    case 'bugs_targeted_next_unreleased_version': {
      if (!params.projectKey) throw new Error('projectKey is required');
      return { 
        name: queryName,
        jql: `project = ${params.projectKey} AND issuetype = Bug AND fixVersion = earliestUnreleasedVersion(${params.projectKey})`,
        params: {}
      };
    }

    case 'bugs_in_unreleased_versions': {
      if (!params.projectKey) throw new Error('projectKey is required');
      return { 
        name: queryName,
        jql: `project = ${params.projectKey} AND issuetype = Bug AND fixVersion IN unreleasedVersions(${params.projectKey})`,
        params: {}
      };
    }

    case 'bugs_affecting_version': {
      if (!(params as any).version) throw new Error('version is required');
      return { 
        name: queryName,
        jql: `issuetype = Bug AND affectedVersion = ${JSON.stringify((params as any).version)}`,
        params: { version: (params as any).version }
      };
    }

    case 'bugs_in_open_sprints':
      return { 
        name: queryName,
        jql: `issuetype = Bug AND Sprint IN openSprints()`,
        params: {}
      };

    case 'reopened_bugs_last_30d':
      return { 
        name: queryName,
        jql: `issuetype = Bug AND status CHANGED TO "Reopened" AFTER -30d`,
        params: {}
      };

    case 'reopened_without_reopened_step_30d':
      return { 
        name: queryName,
        jql: `issuetype = Bug AND status WAS "Done" AND statusCategory != Done AND updated >= -30d`,
        params: {}
      };

    case 'duplicates_last_90d':
      return { 
        name: queryName,
        jql: `issuetype = Bug AND resolution = Duplicate AND resolutiondate >= -90d`,
        params: {}
      };

    case 'bugs_no_fix_version':
      return { 
        name: queryName,
        jql: `issuetype = Bug AND fixVersion IS EMPTY`,
        params: {}
      };

    case 'bugs_linked_to_issue': {
      if (!(params as any).issueKey) throw new Error('issueKey is required');
      if ((params as any).linkType) {
        return { 
          name: queryName,
          jql: `issuetype = Bug AND issue IN linkedIssues(${JSON.stringify((params as any).issueKey)}, ${JSON.stringify((params as any).linkType)})`,
          params: { issueKey: (params as any).issueKey, linkType: (params as any).linkType }
        };
      }
      return { 
        name: queryName,
        jql: `issuetype = Bug AND issue IN linkedIssues(${JSON.stringify((params as any).issueKey)})`,
        params: { issueKey: (params as any).issueKey }
      };
    }

    case 'open_bugs_env_contains': {
      if (!(params as any).text) throw new Error('text is required for environment search');
      return { 
        name: queryName,
        jql: `issuetype = Bug AND statusCategory != Done AND environment ~ ${JSON.stringify((params as any).text)}`,
        params: { text: (params as any).text }
      };
    }

    default: {
      // Standard JQL generation for other queries
      const parsedParams = query.params.parse(params);
      let jql = query.jql(parsedParams);
      
      // Add project filter if projectKey is provided
      if (params.projectKey) {
        // Split the JQL into WHERE and ORDER BY parts
        const orderByIndex = jql.toUpperCase().indexOf(' ORDER BY ');
        if (orderByIndex > 0) {
          const whereClause = jql.substring(0, orderByIndex);
          const orderByClause = jql.substring(orderByIndex);
          jql = `project = ${params.projectKey} AND (${whereClause})${orderByClause}`;
        } else {
          jql = `project = ${params.projectKey} AND (${jql})`;
        }
      }
      
      return {
        name: queryName,
        jql,
        params: parsedParams
      };
    }
  }
}
