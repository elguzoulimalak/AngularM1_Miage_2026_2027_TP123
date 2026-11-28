import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Page } from '../models/page.model';
import { Track, TrackVisibility } from '../models/track.model';

/** Encapsulates all HTTP operations for backing tracks. */
@Injectable({ providedIn: 'root' })
export class TrackService {
  private readonly http = inject(HttpClient);

  /** My tracks, optionally filtered by title (`q`). */
  list(page = 1, limit = 5, q = '') {
    return this.http.get<Page<Track>>('/api/tracks', { params: this.pageParams(page, limit, q) });
  }

  /** Public tracks of every user, most recent first, optionally filtered by title. */
  listPublic(page = 1, limit = 5, q = '') {
    return this.http.get<Page<Track>>('/api/tracks/public', { params: this.pageParams(page, limit, q) });
  }

  /** Tracks that friends shared with me (TP4 step 2). */
  listShared(page = 1, limit = 5, q = '') {
    return this.http.get<Page<Track>>('/api/tracks/shared', { params: this.pageParams(page, limit, q) });
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

  /** `q` is only sent when not empty, so the URL stays clean without a search. */
  private pageParams(page: number, limit: number, q: string): HttpParams {
    let params = new HttpParams().set('page', page).set('limit', limit);
    const search = q.trim();
    if (search) params = params.set('q', search);
    return params;
  }
}
