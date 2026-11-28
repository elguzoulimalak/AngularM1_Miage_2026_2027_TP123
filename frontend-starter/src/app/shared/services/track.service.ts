import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Page } from '../models/page.model';
import { Track, TrackVisibility } from '../models/track.model';
import { TrackFilters } from '../models/track-filters.model';

/** Encapsulates all HTTP operations for backing tracks. */
@Injectable({ providedIn: 'root' })
export class TrackService {
  private readonly http = inject(HttpClient);

  /** My tracks, optionally filtered by title (`q`). */
  list(page = 1, limit = 5, q = '', filters: TrackFilters = {}) {
    return this.http.get<Page<Track>>('/api/tracks', { params: this.pageParams(page, limit, q, filters) });
  }

  /** Public tracks of every user, most recent first, optionally filtered by title. */
  listPublic(page = 1, limit = 5, q = '', filters: TrackFilters = {}) {
    return this.http.get<Page<Track>>('/api/tracks/public', { params: this.pageParams(page, limit, q, filters) });
  }

  /** Tracks that friends shared with me (TP4 step 2). */
  listShared(page = 1, limit = 5, q = '', filters: TrackFilters = {}) {
    return this.http.get<Page<Track>>('/api/tracks/shared', { params: this.pageParams(page, limit, q, filters) });
  }

  /** Shares one of my tracks with a friend. */
  share(trackId: string, userId: string) {
    return this.http.put<Track>(`/api/tracks/${trackId}/shares/${userId}`, {});
  }

  /** Stops sharing one of my tracks with a user. */
  unshare(trackId: string, userId: string) {
    return this.http.delete<Track>(`/api/tracks/${trackId}/shares/${userId}`);
  }

  upload(file: File, title: string, visibility: TrackVisibility = 'private') {
    const body = new FormData();
    body.append('audio', file);
    body.append('title', title);
    body.append('visibility', visibility);
    return this.http.post<Track>('/api/tracks', body, {
      reportProgress: true,
      observe: 'events',
    });
  }

  setVisibility(id: string, visibility: TrackVisibility) {
    return this.http.patch<Track>(`/api/tracks/${id}`, { visibility });
  }

  delete(id: string) {
    return this.http.delete<void>(`/api/tracks/${id}`);
  }

  audio(id: string) {
    return this.http.get(`/api/tracks/${id}/audio`, {
      responseType: 'blob',
    });
  }

  /**
   * Search parameters are only sent when they are useful, so the URL stays
   * clean: no empty `q`, `format` or `owner`, and no `sort` for the default order.
   */
  private pageParams(page: number, limit: number, q: string, filters: TrackFilters = {}): HttpParams {
    let params = new HttpParams().set('page', page).set('limit', limit);
    const search = q.trim();
    if (search) params = params.set('q', search);
    if (filters.format) params = params.set('format', filters.format);
    if (filters.sort && filters.sort !== 'recent') params = params.set('sort', filters.sort);
    const owner = filters.owner?.trim();
    if (owner) params = params.set('owner', owner);
    return params;
  }
}
