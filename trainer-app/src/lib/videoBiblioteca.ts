// La biblioteca de videos (v41): un coach adjunta su video de técnica a un
// ejercicio de la biblioteca — público (todos) o privado (él y sus alumnos).
// Al agregar el ejercicio a un plan, el video resuelto se copia a la fila:
// el del PROPIO coach manda; si no tiene, un público cualquiera.
//
// ESPEJO de web/src/lib/videoBiblioteca.ts — mismos casos de test.

export interface VideoLib {
  library_id: string;
  coach_id: string;
  video_url: string;
  is_public: boolean;
}

export function resolverVideo(videos: VideoLib[], libraryId: string, mio: string | null | undefined): string | null {
  const del = videos.filter(v => v.library_id === libraryId);
  const propio = mio ? del.find(v => v.coach_id === mio) : undefined;
  return (propio ?? del.find(v => v.is_public))?.video_url ?? null;
}
