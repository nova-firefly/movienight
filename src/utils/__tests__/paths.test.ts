import { parsePath, viewToPath, storeKind } from '../paths';

beforeEach(() => {
  localStorage.clear();
});

describe('parsePath', () => {
  it('maps the movie queue', () => {
    expect(parsePath('/movies')).toEqual({ kind: 'movie', view: 'queue' });
  });

  it('maps the show queue', () => {
    expect(parsePath('/shows')).toEqual({ kind: 'show', view: 'queue' });
  });

  it('maps this-or-that for both kinds', () => {
    expect(parsePath('/movies/this-or-that')).toEqual({ kind: 'movie', view: 'this-or-that' });
    expect(parsePath('/shows/this-or-that')).toEqual({ kind: 'show', view: 'this-or-that' });
  });

  it('maps combined (URL segment) to the combined-list view', () => {
    expect(parsePath('/movies/combined')).toEqual({ kind: 'movie', view: 'combined-list' });
    expect(parsePath('/shows/combined')).toEqual({ kind: 'show', view: 'combined-list' });
  });

  it('maps history for both kinds', () => {
    expect(parsePath('/movies/history')).toEqual({ kind: 'movie', view: 'history' });
    expect(parsePath('/shows/history')).toEqual({ kind: 'show', view: 'history' });
  });

  it('maps /admin to the admin view (kind-agnostic)', () => {
    expect(parsePath('/admin')).toEqual({ kind: 'movie', view: 'admin' });
  });

  it('falls back to the movie queue for / when nothing is stored', () => {
    expect(parsePath('/')).toEqual({ kind: 'movie', view: 'queue' });
  });

  it('uses the stored kind for /', () => {
    storeKind('show');
    expect(parsePath('/')).toEqual({ kind: 'show', view: 'queue' });
  });

  it('falls back to the movie queue for an unknown top-level path', () => {
    expect(parsePath('/nonsense')).toEqual({ kind: 'movie', view: 'queue' });
  });

  it('falls back to the queue for an unknown second segment', () => {
    expect(parsePath('/shows/wat')).toEqual({ kind: 'show', view: 'queue' });
  });

  it('tolerates a trailing slash', () => {
    expect(parsePath('/shows/history/')).toEqual({ kind: 'show', view: 'history' });
  });
});

describe('viewToPath', () => {
  it('is the inverse of parsePath for canonical paths', () => {
    const cases: Array<[string]> = [
      ['/movies'],
      ['/shows'],
      ['/movies/this-or-that'],
      ['/shows/this-or-that'],
      ['/movies/combined'],
      ['/shows/combined'],
      ['/movies/history'],
      ['/shows/history'],
      ['/admin'],
    ];
    for (const [path] of cases) {
      const { kind, view } = parsePath(path);
      expect(viewToPath(kind, view)).toBe(path);
    }
  });

  it('routes admin to /admin regardless of kind', () => {
    expect(viewToPath('movie', 'admin')).toBe('/admin');
    expect(viewToPath('show', 'admin')).toBe('/admin');
  });
});
