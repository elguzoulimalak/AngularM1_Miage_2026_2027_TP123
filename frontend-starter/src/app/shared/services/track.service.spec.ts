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

  it('list() n\'envoie q que si une recherche est saisie', () => {
    service.list(1, 5, '  blues ').subscribe();
    const req = http.expectOne((r) => r.url === '/api/tracks');
    expect(req.request.params.get('q')).toBe('blues');
    req.flush({ items: [], page: 1, limit: 5, total: 0, pages: 1 });

    service.list().subscribe();
    const req2 = http.expectOne((r) => r.url === '/api/tracks');
    expect(req2.request.params.has('q')).toBe(false);
    req2.flush({ items: [], page: 1, limit: 5, total: 0, pages: 1 });
  });

  it('listPublic() appelle GET /api/tracks/public avec la recherche', () => {
    service.listPublic(2, 10, 'jazz').subscribe();
    const req = http.expectOne((r) => r.url === '/api/tracks/public');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('limit')).toBe('10');
    expect(req.request.params.get('q')).toBe('jazz');
    req.flush({ items: [], page: 2, limit: 10, total: 0, pages: 1 });
  });

  it('setVisibility() envoie PATCH /api/tracks/:id avec la visibilité', () => {
    service.setVisibility('abc123', 'public').subscribe();
    const req = http.expectOne('/api/tracks/abc123');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ visibility: 'public' });
    req.flush({});
  });

  it('listShared(), share() et unshare() utilisent les routes de partage', () => {
    service.listShared(1, 5, 'riff').subscribe();
    const list = http.expectOne((r) => r.url === '/api/tracks/shared');
    expect(list.request.params.get('q')).toBe('riff');
    list.flush({ items: [], page: 1, limit: 5, total: 0, pages: 1 });

    service.share('t1', 'u2').subscribe();
    const share = http.expectOne('/api/tracks/t1/shares/u2');
    expect(share.request.method).toBe('PUT');
    share.flush({});

    service.unshare('t1', 'u2').subscribe();
    const unshare = http.expectOne('/api/tracks/t1/shares/u2');
    expect(unshare.request.method).toBe('DELETE');
    unshare.flush({});
  });

  it('delete() appelle DELETE /api/tracks/:id', () => {
    service.delete('abc123').subscribe();

    const req = http.expectOne('/api/tracks/abc123');
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('upload() envoie un multipart avec audio et title, et demande la progression', () => {
    const file = new File(['abc'], 'song.mp3', { type: 'audio/mpeg' });
    service.upload(file, 'Ma piste', 'public').subscribe();

    const req = http.expectOne('/api/tracks');
    expect(req.request.method).toBe('POST');
    expect(req.request.reportProgress).toBe(true);
    const body = req.request.body as FormData;
    expect(body.get('title')).toBe('Ma piste');
    expect(body.get('visibility')).toBe('public');
    expect((body.get('audio') as File).name).toBe('song.mp3');
    req.flush({});
  });
});