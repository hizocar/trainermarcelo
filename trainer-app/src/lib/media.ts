import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';

// Límite del bucket exercise-media (50MB); validamos antes de subir para dar buen mensaje
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

// Abre la galería y devuelve el asset elegido (o null si cancela).
export async function pickImage(): Promise<ImagePicker.ImagePickerAsset | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    quality: 0.7,
  });
  return result.canceled ? null : result.assets[0];
}

export async function pickVideo(): Promise<ImagePicker.ImagePickerAsset | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['videos'],
    quality: 0.7,
  });
  return result.canceled ? null : result.assets[0];
}

// Sube imagen o video a Supabase Storage y devuelve su URL pública.
// path debe empezar con el uid del usuario (lo exigen las políticas del bucket).
export async function uploadMedia(
  bucket: 'exercise-media' | 'avatars',
  path: string,
  asset: ImagePicker.ImagePickerAsset,
): Promise<string> {
  const res = await fetch(asset.uri);
  const blob = await res.blob();

  if (blob.size > MAX_UPLOAD_BYTES) {
    throw new Error(`El archivo pesa ${(blob.size / 1024 / 1024).toFixed(0)}MB y el máximo es 50MB. Usa un video más corto o pega un link de YouTube.`);
  }

  const fallback = asset.type === 'video' ? 'video/mp4' : 'image/jpeg';
  const contentType = asset.mimeType ?? (blob.type || fallback);

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, blob, { contentType, upsert: true });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  // cache-bust: el path es estable pero el contenido cambia al re-subir
  return `${data.publicUrl}?v=${Date.now()}`;
}

// alias retrocompatible
export const uploadImage = uploadMedia;

// Sube al bucket PRIVADO de fotos de progreso y devuelve el path (no URL pública).
export async function uploadPrivatePhoto(
  path: string,
  asset: ImagePicker.ImagePickerAsset,
): Promise<string> {
  const res = await fetch(asset.uri);
  const blob = await res.blob();
  if (blob.size > 10 * 1024 * 1024) {
    throw new Error('La foto pesa más de 10MB. Usa una resolución menor.');
  }
  const { error } = await supabase.storage
    .from('progress-photos')
    .upload(path, blob, { contentType: asset.mimeType ?? blob.type ?? 'image/jpeg', upsert: true });
  if (error) throw new Error(error.message);
  return path;
}

// URL firmada temporal para ver una foto privada (1 hora)
export async function signedPhotoUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('progress-photos')
    .createSignedUrl(path, 3600);
  return error ? null : data.signedUrl;
}

// Los videos subidos al bucket se reproducen inline; los links externos (YouTube) se abren fuera.
export function isUploadedVideo(url: string): boolean {
  return url.includes('/storage/v1/object/public/exercise-media/');
}

export function videoExtension(asset: ImagePicker.ImagePickerAsset): string {
  const fromMime = asset.mimeType?.split('/')[1];
  if (fromMime) return fromMime === 'quicktime' ? 'mov' : fromMime;
  const fromUri = asset.uri.split('?')[0].split('.').pop();
  return fromUri && fromUri.length <= 4 ? fromUri : 'mp4';
}
