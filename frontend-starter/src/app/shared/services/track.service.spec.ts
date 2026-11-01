import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TrackService } from './track.service';

describe('TrackService', () => {
  let service: TrackService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TrackService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('list() transmet page et limit au backend', () => {
    service.list(3, 10).subscribe();

    const req = http.expectOne((r) => r.url === '/api/tracks');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('3');
    expect(req.request.params.get('limit')).toBe('10');
    req.flush({ items: [], page: 3, limit: 10, total: 0, pages: 0 });
  });

  it('delete() appelle DELETE /api/tracks/:id', () => {
    service.delete('abc123').subscribe();

    const req = http.expectOne('/api/tracks/abc123');
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('upload() envoie un multipart avec audio et title, et demande la progression', () => {
    const file = new File(['abc'], 'song.mp3', { type: 'audio/mpeg' });
    service.upload(file, 'Ma piste').subscribe();

    const req = http.expectOne('/api/tracks');
    expect(req.request.method).toBe('POST');
    expect(req.request.reportProgress).toBe(true);
    const body = req.request.body as FormData;
    expect(body.get('title')).toBe('Ma piste');
    expect((body.get('audio') as File).name).toBe('song.mp3');
    req.flush({});
  });
});