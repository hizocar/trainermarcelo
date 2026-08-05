import { useEffect, useRef, useState, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { isBiometricEnabled, authenticate } from '../lib/biometricLock';

// Bloquea la app (si el usuario activó Face ID) al abrirla y cada vez que
// vuelve del background real — no de un simple 'inactive'.
//
// 'inactive' es un estado transitorio que iOS también reporta al mostrar
// CUALQUIER UI nativa por encima de la app (el propio prompt de Face ID,
// un Alert, el selector de fotos, etc.) — si lo tratáramos como "se fue a
// segundo plano" quedaríamos en loop: autenticar dispara el prompt → el
// prompt dispara 'inactive' → eso vuelve a bloquear la app apenas se
// desbloquea. Solo 'background' de verdad (Home, app switcher, apagar
// pantalla) cuenta como salida real de la app.
export function useBiometricLock(userId: string | undefined) {
  const [locked, setLocked] = useState(false);
  const [ready, setReady] = useState(false);
  const userIdRef = useRef(userId);
  const appState = useRef(AppState.currentState);
  const authenticatingRef = useRef(false);

  useEffect(() => { userIdRef.current = userId; }, [userId]);

  // Siempre lee la preferencia real en vez de un valor cacheado — evita
  // quedar desactualizado justo después de activar el switch en Ajustes.
  const refresh = useCallback(async (id: string | undefined) => {
    if (!id) { setLocked(false); setReady(true); return; }
    const enabled = await isBiometricEnabled(id);
    setLocked(enabled);
    setReady(true);
  }, []);

  useEffect(() => {
    setReady(false);
    refresh(userId);
  }, [userId, refresh]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next: AppStateStatus) => {
      const wasBackgrounded = appState.current === 'background';
      appState.current = next;
      if (authenticatingRef.current || !wasBackgrounded || next !== 'active') return;
      const id = userIdRef.current;
      if (id && (await isBiometricEnabled(id))) setLocked(true);
    });
    return () => sub.remove();
  }, []);

  async function tryUnlock(): Promise<boolean> {
    authenticatingRef.current = true;
    try {
      const ok = await authenticate();
      if (ok) setLocked(false);
      return ok;
    } finally {
      authenticatingRef.current = false;
    }
  }

  return { locked, ready, tryUnlock, refreshLockPreference: () => refresh(userId) };
}
