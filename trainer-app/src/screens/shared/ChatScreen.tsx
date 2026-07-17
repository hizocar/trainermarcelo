import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  useAudioRecorder, RecordingPresets, AudioModule, setAudioModeAsync,
} from 'expo-audio';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Message } from '../../types';
import { colors, spacing, radius, typography } from '../../theme';
import Avatar from '../../components/common/Avatar';
import ChatImage from '../../components/common/ChatImage';
import AudioBubble from '../../components/common/AudioBubble';
import { uploadChatMedia } from '../../lib/chat';
import { showAlert } from '../../lib/alert';
import { formatShortDate } from '../../lib/weeks';

// Params: la contraparte de la conversación.
type RouteParams = { peerId: string; peerName: string; peerAvatar?: string | null; coachId: string; clientId: string };

export default function ChatScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { peerId, peerName, peerAvatar, coachId, clientId } = route.params as RouteParams;
  const { user } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const listRef = useRef<FlatList>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // inserta el mensaje en la BD (texto y/o adjunto)
  async function insertMessage(fields: Partial<Message>) {
    const { data, error } = await supabase.from('messages').insert({
      coach_id: coachId, client_id: clientId, sender_id: user!.id, ...fields,
    }).select().single();
    if (error) throw new Error(error.message);
    if (data) setMessages(prev => prev.some(x => x.id === data.id) ? prev : [...prev, data]);
  }

  async function attachImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (res.canceled) return;
    setSending(true);
    try {
      const asset = res.assets[0];
      const ext = (asset.mimeType?.split('/')[1] ?? 'jpg').replace('jpeg', 'jpg');
      const path = await uploadChatMedia(coachId, clientId, asset.uri, asset.mimeType ?? 'image/jpeg', ext);
      await insertMessage({ media_type: 'image', media_path: path, body: null });
    } catch (e: any) {
      showAlert('No se pudo enviar la imagen', e.message);
    }
    setSending(false);
  }

  async function startRecording() {
    const perm = await AudioModule.requestRecordingPermissionsAsync();
    if (!perm.granted) { showAlert('Permiso de micrófono', 'Actívalo en Ajustes para enviar notas de voz.'); return; }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setRecording(true);
  }

  async function stopAndSendRecording(cancel = false) {
    setRecording(false);
    await recorder.stop();
    const uri = recorder.uri;
    if (cancel || !uri) return;
    setSending(true);
    try {
      const path = await uploadChatMedia(coachId, clientId, uri, 'audio/m4a', 'm4a');
      await insertMessage({ media_type: 'audio', media_path: path, body: null });
    } catch (e: any) {
      showAlert('No se pudo enviar el audio', e.message);
    }
    setSending(false);
  }

  useEffect(() => {
    fetchMessages();

    // Realtime: nuevos mensajes de esta conversación
    const channel = supabase
      .channel(`chat:${coachId}:${clientId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `coach_id=eq.${coachId}`,
      }, payload => {
        const m = payload.new as Message;
        if (m.client_id !== clientId) return;
        setMessages(prev => prev.some(x => x.id === m.id) ? prev : [...prev, m]);
        if (m.sender_id !== user?.id) markRead([m.id]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [coachId, clientId]);

  async function fetchMessages() {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('coach_id', coachId).eq('client_id', clientId)
      .order('created_at', { ascending: true });
    const list = data ?? [];
    setMessages(list);
    setLoading(false);

    const unread = list.filter(m => m.sender_id !== user?.id && !m.read_at).map(m => m.id);
    if (unread.length) markRead(unread);
  }

  async function markRead(ids: string[]) {
    await supabase.from('messages').update({ read_at: new Date().toISOString() }).in('id', ids);
  }

  async function send() {
    const body = text.trim();
    if (!body || sending || !user) return;
    setSending(true);
    setText('');
    try {
      await insertMessage({ body });
    } catch {
      setText(body);
    }
    setSending(false);
  }

  useEffect(() => {
    if (messages.length) requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, [messages.length]);

  const renderItem = ({ item, index }: { item: Message; index: number }) => {
    const mine = item.sender_id === user?.id;
    const prev = messages[index - 1];
    const showDate = !prev || prev.created_at.slice(0, 10) !== item.created_at.slice(0, 10);
    const time = new Date(item.created_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    return (
      <>
        {showDate && (
          <View style={styles.dateChip}>
            <Text style={styles.dateChipText}>{formatShortDate(item.created_at).toUpperCase()}</Text>
          </View>
        )}
        <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowPeer]}>
          <View style={[
            styles.bubble,
            mine ? styles.bubbleMine : styles.bubblePeer,
            item.media_type === 'image' && styles.bubbleImage,
          ]}>
            {item.media_type === 'image' && item.media_path ? (
              <ChatImage path={item.media_path} />
            ) : item.media_type === 'audio' && item.media_path ? (
              <AudioBubble path={item.media_path} mine={mine} />
            ) : (
              <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{item.body}</Text>
            )}
            <Text style={[
              styles.bubbleTime, mine && styles.bubbleTimeMine,
              item.media_type === 'image' && styles.bubbleTimeOnImage,
            ]}>{time}</Text>
          </View>
        </View>
      </>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Avatar name={peerName} imageUrl={peerAvatar} size={38} accent />
        <Text style={styles.peerName} numberOfLines={1}>{peerName}</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={m => m.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="chatbubbles-outline" size={40} color={colors.textMuted} />
              <Text style={styles.emptyText}>Escribe el primer mensaje 👋</Text>
            </View>
          }
        />
      )}

      {recording ? (
        <View style={styles.recordBar}>
          <TouchableOpacity onPress={() => stopAndSendRecording(true)} style={styles.recCancel}>
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
          </TouchableOpacity>
          <View style={styles.recPulse} />
          <Text style={styles.recText}>Grabando nota de voz…</Text>
          <TouchableOpacity onPress={() => stopAndSendRecording(false)} style={styles.sendBtn}>
            <Ionicons name="arrow-up" size={20} color={colors.background} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.inputBar}>
          <TouchableOpacity onPress={attachImage} disabled={sending} style={styles.attachBtn}>
            <Ionicons name="image-outline" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Escribe un mensaje..."
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={2000}
          />
          {text.trim() ? (
            <TouchableOpacity style={styles.sendBtn} onPress={send} disabled={sending}>
              <Ionicons name="arrow-up" size={20} color={colors.background} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.micBtn} onPress={startRecording} disabled={sending}>
              {sending ? <ActivityIndicator color={colors.accent} size="small" /> : <Ionicons name="mic" size={22} color={colors.accent} />}
            </TouchableOpacity>
          )}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 56 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingBottom: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  peerName: { ...typography.h3, flex: 1 },
  list: { padding: spacing.md, gap: 3, flexGrow: 1 },
  dateChip: { alignSelf: 'center', marginVertical: spacing.sm },
  dateChipText: { ...typography.label, fontSize: 9, letterSpacing: 1.5 },
  bubbleRow: { flexDirection: 'row', marginVertical: 1 },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowPeer: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  bubbleMine: { backgroundColor: colors.accent, borderBottomRightRadius: 4 },
  bubblePeer: { backgroundColor: colors.cardElevated, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.border },
  bubbleImage: { padding: 4 },
  bubbleText: { ...typography.body, fontSize: 15 },
  bubbleTextMine: { color: colors.background },
  bubbleTime: { fontSize: 9, color: colors.textMuted, alignSelf: 'flex-end', marginTop: 2 },
  bubbleTimeMine: { color: 'rgba(8,9,10,0.55)' },
  bubbleTimeOnImage: {
    position: 'absolute', bottom: 8, right: 10, color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 5, borderRadius: 6, overflow: 'hidden',
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingTop: spacing.xxl },
  emptyText: { ...typography.body, color: colors.textMuted },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, paddingBottom: spacing.lg,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  input: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm,
    color: colors.textPrimary, fontSize: 15, maxHeight: 120,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  attachBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  micBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accentSoft,
    borderWidth: 1, borderColor: colors.accent + '55',
    alignItems: 'center', justifyContent: 'center',
  },
  recordBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, paddingBottom: spacing.lg,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  recCancel: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  recPulse: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger },
  recText: { ...typography.body, color: colors.textSecondary, flex: 1 },
});
