import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from './supabase';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// Cuenta mensajes sin leer que le llegaron al usuario actual en una conversación.
export async function unreadCount(coachId: string, clientId: string, meId: string): Promise<number> {
  const { count } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .neq('sender_id', meId)
    .is('read_at', null);
  return count ?? 0;
}

// Sube un adjunto (imagen o audio) al bucket privado chat-media.
// path: {coach_id}/{client_id}/{archivo}. Devuelve el path guardado.
export async function uploadChatMedia(
  coachId: string,
  clientId: string,
  localUri: string,
  contentType: string,
  ext: string,
): Promise<string> {
  const path = `${coachId}/${clientId}/${Date.now()}.${ext}`;

  if (Platform.OS === 'web') {
    const blob = await (await fetch(localUri)).blob();
    const { error } = await supabase.storage.from('chat-media').upload(path, blob, { contentType });
    if (error) throw new Error(error.message);
    return path;
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sesión expirada');
  const res = await FileSystem.uploadAsync(
    `${SUPABASE_URL}/storage/v1/object/chat-media/${path}`,
    localUri,
    {
      httpMethod: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: ANON_KEY,
        'Content-Type': contentType,
      },
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    },
  );
  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`No se pudo subir (HTTP ${res.status})`);
  }
  return path;
}

// URL firmada temporal para ver/reproducir un adjunto (1 hora).
export async function signedChatMediaUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('chat-media').createSignedUrl(path, 3600);
  return error ? null : data.signedUrl;
}
