import axios, { AxiosInstance } from 'axios';

export type JiraIssue = {
  id: string;
  key: string;
  fields: {
    summary?: string;
    issuetype?: any;
    status?: { name?: string };
    created?: string;
    resolutiondate?: string;
    priority?: { name?: string };
    assignee?: { displayName?: string; accountId?: string } | null;
    reporter?: { displayName?: string; accountId?: string } | null;
    labels?: string[];
    [k: string]: any;
  };
};

export class JiraClient {
  private http: AxiosInstance;
  private baseUrl: string;

  constructor(opts: { baseUrl: string; email: string; apiToken: string }) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, '');
    this.http = axios.create({
      baseURL: this.baseUrl,
      auth: { username: opts.email, password: opts.apiToken },
      headers: { 'Accept': 'application/json' }
    });
  }

  async search(jql: string, startAt = 0, maxResults = 50): Promise<{ issues: JiraIssue[]; total: number }> {
    try {
      console.log('Executing JQL:', jql);
      const { data } = await this.http.post('/rest/api/3/search', {
        jql,
        startAt,
        maxResults,
        fields: [
          'summary',
          'issuetype',
          'status',
          'created',
          'resolutiondate',
          'priority',
          'assignee',
          'reporter',
          'labels'
        ],
      });
      return { issues: data.issues, total: data.total };
    } catch (error: any) {
      console.error('Jira API error:', error.response?.data || error.message);
      throw new Error(`Jira API error: ${error.response?.data?.errorMessages?.join(', ') || error.message}`);
    }
  }

  // Fetch full details for a single issue by key
  async issue(key: string): Promise<JiraIssue> {
    try {
      const { data } = await this.http.get(`/rest/api/3/issue/${encodeURIComponent(key)}`, {
        params: {
          fields: 'summary,issuetype,status,created,resolutiondate,priority,assignee,reporter,labels'
        }
      });
      return data as JiraIssue;
    } catch (error: any) {
      console.error('Jira API error fetching issue:', error.response?.data || error.message);
      throw new Error(`Jira API error: ${error.response?.data?.errorMessages?.join(', ') || error.message}`);
    }
  }

  async count(jql: string): Promise<number> {
    try {
      console.log('Counting with JQL:', jql);
      const { data } = await this.http.post('/rest/api/3/search', { 
        jql, 
        maxResults: 0, 
        fields: [] 
      });
      return data.total as number;
    } catch (error: any) {
      console.error('Jira API count error:', error.response?.data || error.message);
      throw new Error(`Jira API error: ${error.response?.data?.errorMessages?.join(', ') || error.message}`);
    }
  }
}