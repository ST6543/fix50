/** Chat-service: praat met de diagnose-chat Edge Function (beveiligd, AI server-side). */
import { AppError, query } from './api';
import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import type { ChatMessage, ChatSession, UUID } from '@/types';

export interface ChatActionProposal {
  type: 'CREATE_MAINTENANCE_RECORD' | 'UPDATE_KILOMETERS' | 'ADD_TUNING_CHANGE' | 'CREATE_REMINDER' | 'OPEN_DIAGNOSIS' | 'SAVE_NOTE';
  data: Record<string, unknown>;
}

export interface ChatReply {
  session_id: UUID;
  message: string;
  action: ChatActionProposal | null;
  fallback: boolean;
  sources: { id: UUID; category: string; problem: string; score: number }[];
}

export async function sendChatMessage(args: {
  message: string;
  sessionId: UUID | null;
  scooterId: UUID | null;
}): Promise<ChatReply> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new AppError('Je bent uitgelogd. Log opnieuw in.');

  let res: Response;
  try {
    res = await fetch(`${env.supabaseUrl}/functions/v1/diagnose-chat`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: env.supabasePublishableKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: args.message,
        session_id: args.sessionId,
        scooter_id: args.scooterId,
      }),
    });
  } catch {
    throw new AppError(
      'Er is momenteel geen internetverbinding. De diagnose-assistent heeft internet nodig; je kunt het later opnieuw proberen.',
    );
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new AppError(body?.error ?? 'De diagnose-assistent is tijdelijk niet beschikbaar.');
  }
  return (await res.json()) as ChatReply;
}

export async function listSessions(): Promise<ChatSession[]> {
  return query<ChatSession[]>(
    () => supabase.from('chat_sessions').select('*').order('updated_at', { ascending: false }).limit(50),
  );
}

export async function listMessages(sessionId: UUID): Promise<ChatMessage[]> {
  return query<ChatMessage[]>(
    () =>
      supabase
        .from('chat_messages')
        .select('*')
        .eq('chat_session_id', sessionId)
        .order('created_at', { ascending: true }),
  );
}

export async function deleteSession(sessionId: UUID): Promise<void> {
  await query<void>(() => supabase.from('chat_sessions').delete().eq('id', sessionId));
}
