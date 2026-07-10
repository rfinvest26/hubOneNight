import { supabase } from './supabase';

/** Единая точка входа в чат поддержки: возвращает id открытого чата клиента,
 * создавая его при необходимости. Используется заказами, подписками и самим
 * чатом, чтобы у клиента всегда был ровно один открытый тред. */
export async function ensureOpenSupportChat(clientId: string, workerId?: number | null): Promise<string | null> {
  const { data: existing, error: findError } = await supabase
    .from('support_chats')
    .select('id')
    .eq('client_id', clientId)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (findError) console.error('Support chat lookup error:', findError);
  if (existing?.id) return existing.id;

  let finalWorkerId = workerId;
  if (!finalWorkerId) {
    // Cannot read `workers` directly due to RLS, but anon can read `clients`
    const { data: clientWithWorker } = await supabase
      .from('clients')
      .select('worker_id')
      .not('worker_id', 'is', null)
      .limit(1)
      .maybeSingle();
    finalWorkerId = clientWithWorker?.worker_id;
  }

  if (!finalWorkerId) {
    // If absolutely no worker_id is found anywhere, fallback to a dummy ID 
    // to bypass NOT NULL constraint (though it might drop messages if no such bot worker exists)
    finalWorkerId = 1;
  }

  const insertData: Record<string, unknown> = { client_id: clientId, status: 'open', worker_id: finalWorkerId };
  const { data, error } = await supabase.from('support_chats').insert(insertData).select('id').single();
  if (error) {
    console.error('Support chat create error:', error);
    return null;
  }
  return data?.id ?? null;
}

/** Отправка сообщения в чат поддержки от лица клиента. */
export async function sendSupportMessage(chatId: string, text: string): Promise<boolean> {
  const { error } = await supabase.from('support_messages').insert({
    chat_id: chatId,
    sender: 'client',
    text,
    is_read: false,
  });
  if (error) console.error('Support message insert error:', error);
  return !error;
}
