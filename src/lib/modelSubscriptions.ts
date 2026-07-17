import { supabase } from './supabase';

export interface SubscriptionRequestInput {
  clientId: string;
  modelId: string;
  modelName: string;
  modelCode: string;
  clientEmail: string;
  price: number;
  fallbackWorkerId?: number | null;
}

export interface SubscriptionRequestResult {
  ok: boolean;
  created: boolean;
  subscriptionId: string | null;
  supportChatId: string | null;
  error?: string;
}

function readableSubscriptionError(error: { code?: string; message?: string } | null): string {
  const code = String(error?.code ?? '').toUpperCase();
  const message = String(error?.message ?? '').toUpperCase();
  if (code === '23503') return 'Профиль или аккаунт больше недоступен. Обновите страницу.';
  if (code === '42501' || message.includes('ROW-LEVEL SECURITY')) return 'Сервис оплаты обновляется. Повторите попытку через минуту.';
  if (code === '42P01' || message.includes('MODEL_SUBSCRIPTIONS')) return 'Модуль подписок ещё не подключён к базе данных.';
  return 'Не удалось создать заявку на подписку. Повторите попытку.';
}

/**
 * Preferred path is a SECURITY DEFINER RPC: one transaction creates/deduplicates
 * the subscription, worker notification and support chat. The direct-table path
 * keeps older deployments working until migration 14 is applied.
 */
export async function requestModelSubscription(input: SubscriptionRequestInput): Promise<SubscriptionRequestResult> {
  const rpc = await supabase.rpc('request_model_subscription', {
    p_client_id: input.clientId,
    p_model_id: input.modelId,
  });

  if (!rpc.error) {
    const row = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;
    return {
      ok: true,
      created: Boolean(row?.created),
      subscriptionId: row?.subscription_id ?? null,
      supportChatId: row?.support_chat_id ?? null,
    };
  }

  // PGRST202/42883 means the migration has not reached this environment yet.
  const rpcMissing = rpc.error.code === 'PGRST202' || rpc.error.code === '42883' || /function.+not found/i.test(rpc.error.message ?? '');
  if (!rpcMissing) {
    console.error('Subscription RPC error:', rpc.error);
    return { ok: false, created: false, subscriptionId: null, supportChatId: null, error: readableSubscriptionError(rpc.error) };
  }

  const existing = await supabase
    .from('model_subscriptions')
    .select('id,status')
    .eq('client_id', input.clientId)
    .eq('model_id', input.modelId)
    .in('status', ['pending', 'active'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing.error && existing.error.code !== 'PGRST116') {
    console.error('Subscription lookup error:', existing.error);
    return { ok: false, created: false, subscriptionId: null, supportChatId: null, error: readableSubscriptionError(existing.error) };
  }
  if (existing.data?.id) {
    return { ok: true, created: false, subscriptionId: existing.data.id, supportChatId: null };
  }

  const payload: Record<string, unknown> = {
    client_id: input.clientId,
    model_id: input.modelId,
    status: 'pending',
    price: input.price,
  };
  if (input.fallbackWorkerId) payload.worker_id = input.fallbackWorkerId;

  // No .select(): deployments with INSERT but no SELECT policy should still succeed.
  const inserted = await supabase.from('model_subscriptions').insert(payload);
  if (inserted.error && inserted.error.code !== '23505') {
    console.error('Subscription fallback insert error:', inserted.error);
    return { ok: false, created: false, subscriptionId: null, supportChatId: null, error: readableSubscriptionError(inserted.error) };
  }

  const logPayload: Record<string, unknown> = {
    client_id: input.clientId,
    action_type: 'subscription_requested',
    details: {
      model_id: input.modelId,
      model_name: input.modelName,
      model_code: input.modelCode,
      price: input.price,
      email: input.clientEmail,
    },
  };
  if (input.fallbackWorkerId) logPayload.worker_id = input.fallbackWorkerId;
  const { error: logError } = await supabase.from('client_logs').insert(logPayload);
  if (logError) console.error('Subscription fallback log error:', logError);

  return { ok: true, created: true, subscriptionId: null, supportChatId: null };
}
