import { useEffect, useRef, useState, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { isBiometricEnabled, authenticate } from '../lib/biometricLock';

// Bloquea la app (si el usuario activó Face ID) al abrirla y cada vez que
// vuelve del background — no solo en el arranque en frío.
export function useBiometricLock(userId: string | undefined) {
  const [locked, setLocked] = useState(false);
  const [ready, setReady] = useState(false);
  const enabledRef = useRef(false);
  const appState = useRef(AppState.currentState);

  const refresh = useCallback(async (id: string | undefined) => {
    if (!id) { enabledRef.current = false; setLocked(false); setReady(true); return; }
    const enabled = await isBiometricEnabled(id);
    enabledRef.current = enabled;
    setLocked(enabled);
    setReady(true);
  }, []);

  useEffect(() => {
    setReady(false);
    refresh(userId);
  }, [userId, refresh]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && next === 'active' && enabledRef.current) {
        setLocked(true);
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, []);

  async function tryUnlock(): Promise<boolean> {
    const ok = await authenticate();
    if (ok) setLocked(false);
    return ok;
  }

  return { locked, ready, tryUnlock, refreshLockPreference: () => refresh(userId) };
}
