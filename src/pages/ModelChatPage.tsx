import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ModelChatMessage } from '@/types';
import { groupMessagesForDisplay, mergeMessagesById } from '@/lib/chatGrouping';
import AuthModal from '@/components/AuthModal';
import ChatBubble from '@/components/ChatBubble';
import ChatHeader from '@/components/ChatHeader';
import ChatComposer from '@/components/ChatComposer';
import ChatViewport from '@/components/ChatViewport';
import Layout from '@/components/Layout';
import VerifiedBadge from '@/components/VerifiedBadge';
import { useChatScroll } from '@/hooks/useChatScroll';

interface ChatModel {
  name?: string;
  photos?: string[];
  code?: string;
  age?: number;
}

export default function ModelChatPage() {
  const { modelId } = useParams<{ modelId: string }>();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [model, setModel] = useState<ChatModel | null>(null);
  const [loadingModel, setLoadingModel] = useState(true);
  const [messages, setMessages] = useState<ModelChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [error, setError] = useState('');
  const realtimeOk = useRef(false);
  const { scrollRef, contentRef, handleScroll, scrollToBottom, hasNewMessages } = useChatScroll(messages.length);

  useEffect(() => {
    if (!session) { setShowAuth(true); return; }
    realtimeOk.current = false;
    setLoadingModel(true);
    setModel(null);
    setMessages([]);
    setError('');
    fetchModel();
    fetchMessages();
    const unsub = subscribeRealtime();
    const interval = setInterval(() => { if (!realtimeOk.current) fetchMessages(); }, 5000);
    return () => { unsub(); clearInterval(interval); };
  }, [modelId, session]);

  const fetchModel = async () => {
    if (!modelId) return;
    const { data, error: modelError } = await supabase.from('models').select('name, photos, code, age').eq('id', modelId).maybeSingle();
    if (modelError) {
      console.error('Model chat model fetch error:', modelError);
      setError('Не удалось загрузить анкету. Обновите страницу.');
    } else if (!data) {
      setError('Анкета больше недоступна. Вернитесь в каталог.');
    }
    setModel(data);
    setLoadingModel(false);
  };

  const fetchMessages = async () => {
    if (!session || !modelId) return;
    const { data, error: msgError } = await supabase
      .from('model_chats')
      .select('*')
      .eq('client_id', session.id)
      .eq('model_id', modelId)
      .order('created_at', { ascending: false })
      .limit(300);
    if (msgError) {
      console.error('Model chat messages fetch error:', msgError);
      setError('Не удалось обновить сообщения. Проверьте соединение.');
      return;
    }
    setMessages((current) => mergeMessagesById(current, data ? [...data].reverse() : []));
  };

  const subscribeRealtime = () => {
    const channel = supabase
      .channel(`model_chat_${session!.id}_${modelId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'model_chats', filter: `model_id=eq.${modelId}` },
        (payload) => {
          const msg = payload.new as ModelChatMessage;
          if (msg.client_id !== session!.id) return;
          realtimeOk.current = true;
          setMessages((prev) => mergeMessagesById(prev, [msg]));
        }
      )
      .subscribe((status) => { realtimeOk.current = status === 'SUBSCRIBED'; });
    return () => { supabase.removeChannel(channel); };
  };

  const generateUUID = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  const sendMessage = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || !session || !modelId || !model) return;
    setError('');
    setSending(true);
    setText('');
    const optimistic: ModelChatMessage = {
      id: generateUUID(),
      client_id: session.id,
      model_id: modelId,
      sender: 'client',
      text: trimmed,
      is_read: false,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => mergeMessagesById(prev, [optimistic]));
    try {
      const { error: insertError } = await supabase.from('model_chats').insert({
        id: optimistic.id,
        client_id: session.id,
        model_id: modelId,
        sender: 'client',
        text: trimmed,
        is_read: false,
      });
      if (insertError) throw insertError;
      requestAnimationFrame(() => scrollToBottom('smooth'));
    } catch (sendError) {
      console.error('Model chat message insert error:', sendError);
      setMessages((prev) => prev.filter((msg) => msg.id !== optimistic.id));
      setError('Сообщение не отправлено. Попробуйте ещё раз.');
      setText(trimmed);
    } finally {
      setSending(false);
    }
  };

  const displayItems = useMemo(() => groupMessagesForDisplay(messages), [messages]);

  if (!session) {
    return (
      <Layout>
        <div className="min-h-[70dvh] bg-white text-[#202020] flex items-center justify-center px-5">
          <div className="max-w-sm text-center">
            <h1 className="text-3xl font-black">Войдите, чтобы написать модели</h1>
            <button onClick={() => setShowAuth(true)} className="mt-6 h-12 rounded-lg bg-[#ff5a82] px-6 font-semibold text-white">Войти</button>
          </div>
          {showAuth && <AuthModal onClose={() => navigate(-1)} onSuccess={() => setShowAuth(false)} />}
        </div>
      </Layout>
    );
  }

  return (
    <ChatViewport
      header={
        <ChatHeader
          onBack={() => navigate('/profile?tab=chats')}
          avatar={
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-[#eee]">
              {model?.photos?.[0] && <img src={model.photos[0]} alt="" className="h-full w-full object-cover" />}
            </div>
          }
          title={<>{model?.name || 'Модель'}{model?.age ? `, ${model.age}` : ''} <VerifiedBadge size={15} /></>}
          status="онлайн через менеджера"
        />
      }
      composer={
        <ChatComposer
          text={text}
          onTextChange={setText}
          onSend={sendMessage}
          placeholder="Сообщение модели"
          busy={sending}
          error={error}
          disabled={loadingModel || !model}
          onFocus={() => setTimeout(() => scrollToBottom('smooth'), 120)}
        />
      }
      scrollRef={scrollRef}
      contentRef={contentRef}
      onScroll={handleScroll}
      hasNewMessages={hasNewMessages}
      onShowLatest={() => scrollToBottom('smooth')}
    >
            {messages.length === 0 && (loadingModel ? (
              <div className="m-auto flex items-center gap-2 text-sm font-medium text-[#777]">
                <Loader2 size={18} className="animate-spin" /> Загружаем диалог
              </div>
            ) : model ? (
              <div className="mx-auto my-auto w-full max-w-md rounded-[20px] border border-[#dfded9] bg-white p-6 text-center text-[#202020] shadow-[0_14px_38px_rgba(30,30,28,0.06)]">
                <ShieldCheck size={28} className="mx-auto mb-3 text-[#ff5a82]" />
                <p className="text-xl font-black">Начните диалог</p>
                <p className="mt-2 text-sm text-[#777]">Сообщение увидит менеджер модели и ответит от её лица.</p>
              </div>
            ) : null)}
            {displayItems.map((item) =>
              item.type === 'divider' ? (
                <div key={item.key} className="sticky top-2 z-[1] my-3 flex items-center justify-center">
                  <span className="rounded-full border border-black/[0.04] bg-[#e9e8e4]/95 px-3 py-1 text-[11px] font-semibold text-[#666] backdrop-blur">{item.label}</span>
                </div>
              ) : (
                <ChatBubble key={item.key} message={item.message} isOwn={item.message.sender === 'client'} showTail={item.showTail} />
              )
            )}
    </ChatViewport>
  );
}
