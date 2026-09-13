import { resolverVideo } from '../videoBiblioteca';

// Mismos casos que web/src/lib/__tests__/videoBiblioteca.test.ts.
const v = (library_id: string, coach_id: string, video_url: string, is_public: boolean) =>
  ({ library_id, coach_id, video_url, is_public });

describe('resolverVideo', () => {
  const videos = [
    v('press', 'marcelo', 'https://x/marcelo.mp4', false),
    v('press', 'otra', 'https://x/publico.mp4', true),
    v('sentadilla', 'otra', 'https://x/sent.mp4', true),
  ];

  it('el video del propio coach manda, aunque haya públicos', () => {
    expect(resolverVideo(videos, 'press', 'marcelo')).toBe('https://x/marcelo.mp4');
  });

  it('sin video propio, hereda un público', () => {
    expect(resolverVideo(videos, 'press', 'yharel')).toBe('https://x/publico.mp4');
  });

  it('un privado ajeno NUNCA se hereda', () => {
    expect(resolverVideo([v('press', 'marcelo', 'https://x/priv.mp4', false)], 'press', 'yharel')).toBeNull();
  });

  it('sin coach (alumno sin coach), solo públicos', () => {
    expect(resolverVideo(videos, 'press', null)).toBe('https://x/publico.mp4');
  });

  it('otro ejercicio no contamina', () => {
    expect(resolverVideo(videos, 'remo', 'marcelo')).toBeNull();
  });
});
