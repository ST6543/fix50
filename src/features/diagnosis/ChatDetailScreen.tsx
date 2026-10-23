/** Chatdetail — diagnose-gesprek met actiebevestiging. */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { AppNav } from '@/navigation/types';

import { Button, IconTile } from '@/components/ui';
import { MotoIcon, SendIcon } from '@/components/icons';
import { FadeInView, PressableScale, TypingIndicator } from '@/components/motion';
import { useAuth } from '@/hooks/useAuth';
import { useScooters } from '@/hooks/useScooters';
import { CHAT_QUICK_ACTIONS } from '@/constants/branding';
import * as chatService from '@/services/chat';
import * as maintenanceService from '@/services/maintenance';
import * as scootersService from '@/services/scooters';
import * as tuningService from '@/services/tuning';
import { colors, fonts, radii, spacing } from '@/theme';
import type { ChatMessage, UUID } from '@/types';

type RouteParams = {
  ChatDetail: { sessionId?: UUID; seedMessage?: string };
};

export default function ChatDetailScreen() {
  const route = useRoute<RouteProp<RouteParams, 'ChatDetail'>>();
  const navigation = useNavigation<AppNav>();
  const { activeScooter } = useScooters();
  const { profile } = useAuth();
  const userInitial = (profile?.display_name ?? 'J').charAt(0).toUpperCase();

  const [sessionId, setSessionId] = useState<UUID | null>(route.params?.sessionId ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<chatService.ChatActionProposal | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  // Seed-bericht van chips op Diagnosis tab
  useEffect(() => {
    const seed = route.params?.seedMessage;
    if (seed && messages.length === 0 && !busy) {
      setInput(seed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.seedMessage]);

  useEffect(() => {
    if (sessionId) void loadHistory(sessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  async function loadHistory(id: UUID) {
    try {
      const msgs = await chatService.listMessages(id);
      setMessages(msgs);
    } catch {
      // offline: lege chat tonen is ok
    }
  }

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;
      setBusy(true);
      setInput('');

      const optimistic: ChatMessage = {
        id: `tmp-${Date.now()}`,
        chat_session_id: sessionId ?? '',
        role: 'user',
        message: trimmed,
        metadata: null,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);

      try {
        const reply = await chatService.sendChatMessage({
          message: trimmed,
          sessionId,
          scooterId: activeScooter?.id ?? null,
        });
        setSessionId(reply.session_id);
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            chat_session_id: reply.session_id,
            role: 'assistant',
            message: reply.message,
            metadata: { sources: reply.sources, fallback: reply.fallback },
            created_at: new Date().toISOString(),
          },
        ]);
        if (reply.action) setPendingAction(reply.action);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            id: `e-${Date.now()}`,
            chat_session_id: '',
            role: 'assistant',
            message: err instanceof Error ? err.message : 'Er ging iets mis. Probeer het opnieuw.',
            metadata: null,
            created_at: new Date().toISOString(),
          },
        ]);
      } finally {
        setBusy(false);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      }
    },
    [busy, sessionId, activeScooter],
  );

  /** Voert een goedgekeurde AI-actie uit via normale services (geen vrije SQL). */
  async function confirmAction() {
    if (!pendingAction || !activeScooter) return;
    const a = pendingAction;
    setPendingAction(null);
    try {
      if (a.type === 'CREATE_MAINTENANCE_RECORD') {
        await maintenanceService.registerMaintenance({
          scooterId: activeScooter.id,
          itemId: null,
          customName: String(a.data.item_name ?? 'Onderhoud'),
          kmAtService: (a.data.km_at_service as number | null) ?? activeScooter.current_km,
          notes: (a.data.notes as string | null) ?? null,
        });
        Alert.alert('Opgeslagen', 'Onderhoud is geregistreerd.');
      } else if (a.type === 'UPDATE_KILOMETERS') {
        await scootersService.updateKilometers(activeScooter.id, Number(a.data.current_km));
        Alert.alert('Opgeslagen', 'Kilometerstand bijgewerkt.');
      } else if (a.type === 'ADD_TUNING_CHANGE') {
        await tuningService.addChange({
          scooterId: activeScooter.id,
          part: String(a.data.part ?? 'Wijziging'),
          oldValue: (a.data.old_value as string | null) ?? null,
          newValue: (a.data.new_value as string | null) ?? null,
          notes: (a.data.notes as string | null) ?? null,
        });
        Alert.alert('Opgeslagen', 'Tuningwijziging geregistreerd.');
      } else if (a.type === 'CREATE_REMINDER') {
        await maintenanceService.registerMaintenance({
          scooterId: activeScooter.id,
          itemId: null,
          customName: String(a.data.title ?? 'Herinnering'),
          kmAtService: null,
          notes: 'Aangemaakt vanuit diagnose-chat',
        });
        Alert.alert('Opgeslagen', 'Herinnering als notitie opgeslagen.');
      } else if (a.type === 'SAVE_NOTE') {
        await tuningService.addChange({
          scooterId: activeScooter.id,
          part: 'Notitie',
          notes: String(a.data.note ?? ''),
        });
        Alert.alert('Opgeslagen', 'Notitie opgeslagen bij tuninggeschiedenis.');
      } else if (a.type === 'OPEN_DIAGNOSIS') {
        // Diagnosedetail bestaat als chat-antwoord; hier alleen bevestiging.
        Alert.alert('Geopend', 'Dit record zit al in het antwoord hierboven.');
      }
    } catch (err) {
      Alert.alert('Mislukt', err instanceof Error ? err.message : 'Actie mislukt.');
    }
  }

  function renderMessage({ item }: { item: ChatMessage }) {
    const isUser = item.role === 'user';
    return (
      <FadeInView style={[styles.msgRow, isUser && { justifyContent: 'flex-end' }]}>
        {!isUser ? (
          <IconTile tone="neutral" size={30} radius={9} style={styles.avatarBot}>
            <MotoIcon size={16} color={colors.primary} />
          </IconTile>
        ) : (
          <View style={styles.avatarUser}>
            <Text style={styles.avatarUserText}>{userInitial}</Text>
          </View>
        )}
        <View style={[styles.bubble, isUser ? styles.userBubble : styles.botBubble]}>
          <View style={styles.msgHead}>
            <Text style={styles.msgTag}>{isUser ? 'JIJ' : 'FIX50 BOT'}</Text>
            <Text style={styles.msgTime}>{formatTime(item.created_at)}</Text>
          </View>
          <Text style={isUser ? styles.userText : styles.botText}>{item.message}</Text>
        </View>
      </FadeInView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListFooterComponent={
            busy ? (
              <FadeInView style={[styles.msgRow, styles.typingRow]}>
                <IconTile tone="neutral" size={30} radius={9} style={styles.avatarBot}>
                  <MotoIcon size={16} color={colors.primary} />
                </IconTile>
                <View style={[styles.bubble, styles.botBubble, styles.typingBubble]}>
                  <TypingIndicator />
                  <Text style={styles.typingText}>Zoeken in FIX50-diagnosedatabase…</Text>
                </View>
              </FadeInView>
            ) : null
          }
        />

        {pendingAction ? (
          <View style={styles.actionBar}>
            <Text style={styles.actionText}>
              Wil je dit opslaan? ({pendingAction.type.replace(/_/g, ' ').toLowerCase()})
            </Text>
            <View style={styles.actionButtons}>
              <Button label="Opslaan" onPress={confirmAction} style={styles.actionBtn} />
              <Button label="Annuleren" variant="secondary" onPress={() => setPendingAction(null)} style={styles.actionBtn} />
            </View>
          </View>
        ) : null}

        <View style={styles.chipsRow}>
          {CHAT_QUICK_ACTIONS.slice(0, 4).map((c) => (
              <PressableScale key={c} onPress={() => void send(c)} style={styles.miniChip}>
                <Text style={styles.miniChipText}>{c}</Text>
              </PressableScale>
            ))}
        </View>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Beschrijf je probleem…"
            placeholderTextColor={colors.textMuted}
            multiline
            onSubmitEditing={() => void send(input)}
          />
          <PressableScale
            accessibilityLabel="Versturen"
            onPress={() => void send(input)}
            disabled={busy || !input.trim()}
            style={[styles.sendBtn, (!input.trim() || busy) && { opacity: 0.4 }]}
          >
            <SendIcon size={20} color={colors.onPrimary} strokeWidth={2} />
          </PressableScale>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.l, paddingBottom: spacing.s, flexGrow: 1, justifyContent: 'flex-end' },
  msgRow: { flexDirection: 'row', marginBottom: spacing.m },
  bubble: {
    maxWidth: '86%',
    borderRadius: radii.l,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
  },
  userBubble: {
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    borderTopRightRadius: 6,
  },
  botBubble: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopLeftRadius: 6,
  },
  msgHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.l, marginBottom: 3 },
  msgTag: {
    color: colors.primary,
    fontFamily: fonts.display,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  msgTime: { color: colors.textSubtle, fontFamily: fonts.body, fontSize: 12 },
  userText: { color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 14.5, lineHeight: 20, fontWeight: '500' },
  botText: { color: colors.text, fontFamily: fonts.body, fontSize: 14.5, lineHeight: 20 },
  typingRow: { paddingHorizontal: spacing.l, paddingBottom: spacing.s },
  avatarBot: { marginRight: spacing.s, alignSelf: 'flex-start', marginTop: 2 },
  avatarUser: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.s,
    marginTop: 2,
  },
  avatarUserText: { color: colors.primary, fontFamily: fonts.display, fontSize: 12, fontWeight: '700' },
  typingBubble: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  typingText: { color: colors.textMuted, fontSize: 13, flexShrink: 1 },
  actionBar: {
    backgroundColor: colors.surfaceAlt,
    borderTopWidth: 1,
    borderColor: colors.border,
    padding: spacing.m,
  },
  actionText: { color: colors.text, marginBottom: spacing.s, fontSize: 14 },
  actionButtons: { flexDirection: 'row', gap: spacing.s },
  actionBtn: { flex: 1, minHeight: 42 },
  chipsRow: { flexDirection: 'row', paddingHorizontal: spacing.l, paddingTop: spacing.s, gap: spacing.s, flexWrap: 'wrap' },
  miniChip: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.m,
    paddingVertical: 6,
  },
  miniChipText: { color: colors.text, fontSize: 12.5 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.m,
    gap: spacing.s,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.xl,
    color: colors.text,
    paddingHorizontal: spacing.l,
    paddingTop: spacing.m,
    paddingBottom: spacing.m,
    maxHeight: 110,
    fontSize: 15,
  },
  sendBtn: {
    backgroundColor: colors.primary,
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
