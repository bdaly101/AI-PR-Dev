import { ReviewResponse } from '../validation/schemas';

/**
 * API response types
 */

export interface ReviewStatusResponse {
  owner: string;
  repo: string;
  pullNumber: number;
  commitSha: string;
  reviewed: boolean;
  reviewedAt?: string;
  modelUsed?: string;
  reviewSummary?: string;
  severity?: 'info' | 'warning' | 'critical';
  hasHighRisks: boolean;
  riskCount: number;
  suggestionCount: number;
}

export interface SuggestionsResponse {
  owner: string;
  repo: string;
  pullNumber: number;
  suggestions: Array<{
    id: string;
    category: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
    file?: string;
    line?: number;
    actionable: boolean;
  }>;
}

export type MergeRecommendation = 'MERGE' | 'ITERATE' | 'BLOCK';

export interface RecommendationResponse {
  recommendation: MergeRecommendation;
  confidence: number; // 0-1
  reasons: string[];
  reviewSeverity?: 'info' | 'warning' | 'critical';
  ciStatus?: 'pending' | 'success' | 'failure' | 'neutral';
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
}

export interface CIStatusResponse {
  owner: string;
  repo: string;
  commitSha: string;
  checks: Array<{
    name: string;
    status: 'queued' | 'in_progress' | 'completed';
    conclusion?: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required';
    url?: string;
  }>;
  allPassed: boolean;
  hasFailures: boolean;
}

export interface CreateIssueRequest {
  owner: string;
  repo: string;
  pullNumber: number;
  suggestionId?: string;
  title: string;
  body: string;
  labels?: string[];
  priority?: 'low' | 'medium' | 'high';
}

export interface CreateIssueResponse {
  issueNumber: number;
  url: string;
}

export interface ErrorResponse {
  error: string;
  message?: string;
  code?: string;
}

