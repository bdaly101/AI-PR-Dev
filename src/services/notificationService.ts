import { logger } from '../utils/logging';

/**
 * Notification subscription
 */
export interface NotificationSubscription {
  id: string;
  owner: string;
  repo: string;
  pullNumber?: number;
  callbackUrl: string;
  events: string[];
  createdAt: string;
}

/**
 * Review completion event payload
 */
export interface ReviewCompletionEvent {
  owner: string;
  repo: string;
  pullNumber: number;
  commitSha: string;
  reviewedAt: string;
  severity?: 'info' | 'warning' | 'critical';
  riskCount: number;
  suggestionCount: number;
  reviewUrl?: string;
}

class NotificationService {
  private subscriptions: Map<string, NotificationSubscription[]> = new Map();
  private notifLogger = logger.child({ component: 'notification-service' });

  /**
   * Subscribe to review completion events
   */
  subscribe(subscription: NotificationSubscription): void {
    const key = this.getKey(subscription.owner, subscription.repo, subscription.pullNumber);
    
    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, []);
    }
    
    this.subscriptions.get(key)!.push(subscription);
    this.notifLogger.info({ subscriptionId: subscription.id, key }, 'Notification subscription added');
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(subscriptionId: string): void {
    for (const [key, subs] of this.subscriptions.entries()) {
      const index = subs.findIndex(s => s.id === subscriptionId);
      if (index >= 0) {
        subs.splice(index, 1);
        this.notifLogger.info({ subscriptionId, key }, 'Notification subscription removed');
        if (subs.length === 0) {
          this.subscriptions.delete(key);
        }
        return;
      }
    }
  }

  /**
   * Notify subscribers of review completion
   */
  async notifyReviewCompletion(event: ReviewCompletionEvent): Promise<void> {
    const key = this.getKey(event.owner, event.repo, event.pullNumber);
    const subscriptions = this.subscriptions.get(key) || [];
    
    // Also notify repo-wide subscriptions
    const repoKey = this.getKey(event.owner, event.repo, undefined);
    const repoSubscriptions = this.subscriptions.get(repoKey) || [];
    
    const allSubscriptions = [...subscriptions, ...repoSubscriptions]
      .filter(sub => sub.events.includes('review.completed'));

    if (allSubscriptions.length === 0) {
      return;
    }

    this.notifLogger.info({ 
      owner: event.owner,
      repo: event.repo,
      pullNumber: event.pullNumber,
      subscriberCount: allSubscriptions.length,
    }, 'Notifying subscribers of review completion');

    // Send notifications asynchronously
    const promises = allSubscriptions.map(sub => this.sendNotification(sub, event));
    
    try {
      await Promise.allSettled(promises);
    } catch (error) {
      this.notifLogger.error({ error }, 'Error during notification delivery');
    }
  }

  /**
   * Send notification to a subscriber
   */
  private async sendNotification(
    subscription: NotificationSubscription,
    event: ReviewCompletionEvent
  ): Promise<void> {
    try {
      const response = await fetch(subscription.callbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'ai-pr-reviewer/1.0',
        },
        body: JSON.stringify({
          event: 'review.completed',
          timestamp: new Date().toISOString(),
          data: event,
        }),
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      this.notifLogger.debug({ 
        subscriptionId: subscription.id,
        status: response.status,
      }, 'Notification delivered successfully');
    } catch (error) {
      this.notifLogger.warn({ 
        subscriptionId: subscription.id,
        callbackUrl: subscription.callbackUrl,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Failed to deliver notification');
      // Don't throw - we want to continue with other notifications
    }
  }

  /**
   * Get subscription key
   */
  private getKey(owner: string, repo: string, pullNumber?: number): string {
    if (pullNumber) {
      return `${owner}/${repo}#${pullNumber}`;
    }
    return `${owner}/${repo}`;
  }

  /**
   * Get all subscriptions for a repo/PR
   */
  getSubscriptions(owner: string, repo: string, pullNumber?: number): NotificationSubscription[] {
    const key = this.getKey(owner, repo, pullNumber);
    return this.subscriptions.get(key) || [];
  }
}

export const notificationService = new NotificationService();

