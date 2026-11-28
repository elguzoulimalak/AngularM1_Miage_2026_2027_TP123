/** Audio formats accepted by the advanced search (TP4 polish). */
export type TrackFormat = '' | 'mp3' | 'wav' | 'ogg' | 'm4a';

/** Sort orders accepted by the API. */
export type TrackSort = 'recent' | 'oldest' | 'title' | 'size';

/** Advanced search options sent along with `q`. Empty values mean "no filter". */
export interface TrackFilters {
  format?: TrackFormat;
  sort?: TrackSort;
  /** Part of the owner's name (public and shared lists only). */
  owner?: string;
}
