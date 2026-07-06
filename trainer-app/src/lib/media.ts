import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from './supabase';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// Límite del bucket exercise-media (50MB); validamos antes de subir para dar buen mensaje
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

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

function contentTypeOf(asset: ImagePicker.ImagePickerAsset): string {
  return asset.mimeType ?? (asset.type === 'video' ? 'video/mp4' : 'image/jpeg');
}

// Sube el asset al bucket. En web usa blob; en nativo sube directo desde el
// archivo con FileSystem.uploadAsync — fetch(file://).blob() + supabase-js
// sube cuerpos de 0 bytes en iOS/Android.
async function uploadToBucket(
  bucket: string,
  path: string,
  asset: ImagePicker.ImagePickerAsset,
  maxBytes: number,
): Promise<void> {
  const contentType = contentTypeOf(asset);
  const tooBig = `El archivo supera el máximo de ${Math.round(maxBytes / 1024 / 1024)}MB.`;

  if (Platform.OS === 'web') {
    const res = await fetch(asset.uri);
    const blob = await res.blob();
    if (blob.size > maxBytes) throw new Error(tooBig);
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, blob, { contentType, upsert: true });
    if (error) throw new Error(error.message);
    return;
  }

  const info = await FileSystem.getInfoAsync(asset.uri);
  if (info.exists && (info.size ?? 0) > maxBytes) throw new Error(tooBig);

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sesión expirada: vuelve a iniciar sesión.');

  const res = await FileSystem.uploadAsync(
    `${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`,
    asset.uri,
    {
      httpMethod: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: ANON_KEY,
        'Content-Type': contentType,
        'x-upsert': 'true',
      },
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    },
  );
  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`No se pudo subir (HTTP ${res.status}). ${res.body?.slice(0, 120) ?? ''}`);
  }
}

// Sube imagen o video a un bucket público y devuelve su URL pública.
// path debe empezar con el uid del usuario (lo exigen las políticas del bucket).
export async function uploadMedia(
  bucket: 'exercise-media' | 'avatars',
  path: string,
  asset: ImagePicker.ImagePickerAsset,
): Promise<string> {
  await uploadToBucket(bucket, path, asset, MAX_UPLOAD_BYTES);
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
  await uploadToBucket('progress-photos', path, asset, MAX_PHOTO_BYTES);
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
