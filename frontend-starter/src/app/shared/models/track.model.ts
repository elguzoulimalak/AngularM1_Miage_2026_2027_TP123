/** Visibility of a track: private (default) or public (searchable by everyone). */
export type TrackVisibility = 'private' | 'public';

/** Audio track metadata returned by the API. */
export interface Track {
  id: string;
  ownerId?: string;
  /** Only present in the public listing (GET /api/tracks/public). */
  ownerName?: string;
  title: string;
  originalName: string;
  mimeType: string;
  size: number;
  visibility: TrackVisibility;
  /** Ids of the friends this track is shared with (only sent to the owner). */
  sharedWith?: string[];
  createdAt: string;
}
