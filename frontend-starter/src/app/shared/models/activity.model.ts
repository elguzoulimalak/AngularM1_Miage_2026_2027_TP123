/** Kind of event shown in the friends activity feed (TP4 step 3). */
export type ActivityType = 'track_published' | 'track_shared';

/** One event of GET /api/activity. */
export interface ActivityItem {
  id: string;
  type: ActivityType;
  at: string;
  user: { id: string; name: string };
  track: { id: string; title: string };
}

/** Response of GET /api/activity. */
export interface ActivityFeed {
  items: ActivityItem[];
}
