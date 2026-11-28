import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FriendService } from './friend.service';

describe('FriendService', () => {
  let service: FriendService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(FriendService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('overview() appelle GET /api/friends', () => {
    service.overview().subscribe();
    const req = http.expectOne('/api/friends');
    expect(req.request.method).toBe('GET');
    req.flush({ friends: [], incoming: [], outgoing: [] });
  });

  it('invite() envoie l’email nettoyé en POST', () => {
    service.invite('  alice@test.fr ').subscribe();
    const req = http.expectOne('/api/friends/requests');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'alice@test.fr' });
    req.flush({});
  });

  it('activity() appelle GET /api/activity avec la limite', () => {
    service.activity(5).subscribe();
    const req = http.expectOne((r) => r.url === '/api/activity');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('limit')).toBe('5');
    req.flush({ items: [] });
  });

  it('accept(), cancelRequest() et remove() utilisent les bonnes routes', () => {
    service.accept('r1').subscribe();
    const accept = http.expectOne('/api/friends/requests/r1/accept');
    expect(accept.request.method).toBe('POST');
    accept.flush({});

    service.cancelRequest('r2').subscribe();
    const cancel = http.expectOne('/api/friends/requests/r2');
    expect(cancel.request.method).toBe('DELETE');
    cancel.flush(null);

    service.remove('u3').subscribe();
    const remove = http.expectOne('/api/friends/u3');
    expect(remove.request.method).toBe('DELETE');
    remove.flush(null);
  });
});
