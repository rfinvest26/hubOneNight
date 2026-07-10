import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Send, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ModelChatMessage } from '@/types';
import AuthModal from '@/components/AuthModal';
import ChatBubble from '@/components/ChatBubble';
import Layout from '@/components/Layout';
import OnlineDot from '@/components/OnlineDot';
import VerifiedBadge from '@/components/VerifiedBadge';

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
  const [messages, setMessages] = useState<ModelChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const realtimeOk = useRef(false);

  useEffect(() => {
    if (!session) { setShowAuth(true); return; }
    fetchModel();
    fetchMessages();
    const unsub = subscribeRealtime();
    const interval = setInterval(() => { if (!realtimeOk.current) fetchMessages(); }, 5000);
    return () => { unsub(); clearInterval(interval); };
  }, [modelId, session]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchModel = async () => {
    if (!modelId) return;
    const { data, error: modelError } = await supabase.from('models').select('name, photos, code, age').eq('id', modelId).maybeSingle();
    if (modelError) console.error('Model chat model fetch error:', modelError);
    setModel(data);
  };

  const fetchMessages = async () => {
    if (!session || !modelId) return;
    const { data, error: msgError } = await supabase
      .from('model_chats')
      .select('*')
      .eq('client_id', session.id)
      .eq('model_id', modelId)
      .order('created_at', { ascending: true });
    if (msgError) console.error('Model chat messages fetch error:', msgError);
    setMessages(data ?? []);
  };

  const subscribeRealtime = () => {
    const channel = supabase
      .channel(`model_chat_${session!.id}_${modelId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'model_chats', filter: `model_id=eq.${modelId}` },
        (payload) => {
          const msg = payload.new as ModelChatMessage;
          if (msg.client_id !== session!.id) return;
          realtimeOk.current = true;
          setMessages((prev) => prev.find((m) => m.id === msg.id) ? prev : [...prev, msg]);
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
    if (!trimmed || sending || !session || !modelId) return;
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
    setMessages((prev) => [...prev, optimistic]);
    const { error: insertError } = await supabase.from('model_chats').insert({
      id: optimistic.id,
      client_id: session.id,
      model_id: modelId,
      sender: 'client',
      text: trimmed,
      is_read: false,
    });
    if (insertError) {
      console.error('Model chat message insert error:', insertError);
      setMessages((prev) => prev.filter((msg) => msg.id !== optimistic.id));
      setError('Сообщение не отправлено. Попробуйте ещё раз.');
      setText(trimmed);
    }
    setSending(false);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

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
    <Layout hideNav>
      <div className="flex h-dvh flex-col bg-[#202020] md:bg-[#f6f6f6]">
        <header className="shrink-0 bg-white text-[#202020] border-b border-[#e8e8e8] pt-safe">
          <div className="mx-auto flex max-w-[1040px] items-center gap-3 px-4 py-3">
            <button onClick={() => navigate(-1)} aria-label="Назад" className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f1f1f1] active:scale-95">
              <ArrowLeft size={17} />
            </button>
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-[#eee]">
              {model?.photos?.[0] && <img src={model.photos[0]} alt="" className="h-full w-full object-cover" />}
            </div>
            <div className="min-w-0">
              <p className="flex items-center gap-2 truncate font-black">
                {model?.name || 'Модель'}{model?.age ? `, ${model.age}` : ''}
                <VerifiedBadge size={15} />
              </p>
              <p className="flex items-center gap-1.5 text-sm text-[#4773d8]"><OnlineDot /> онлайн через менеджера</p>
            </div>
          </div>
        </header>

        <main className="flex min-h-0 w-full flex-1 flex-col bg-[#f6f6f6]">
          <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col px-4 md:px-6">
          <div className="flex-1 overflow-y-auto py-5">
            {messages.length === 0 && (
              <div className="mx-auto mt-16 max-w-md rounded-[18px] border border-[#e5e5e5] bg-white p-6 text-center text-[#202020]">
                <ShieldCheck size={28} className="mx-auto mb-3 text-[#ff5a82]" />
                <p className="text-xl font-black">Начните диалог</p>
                <p className="mt-2 text-sm text-[#777]">Сообщение увидит менеджер модели и ответит от её лица.</p>
              </div>
            )}
            {messages.map((msg) => (
              <ChatBubble key={msg.id} message={msg} isOwn={msg.sender === 'client'} />
            ))}
            <div ref={bottomRef} />
          </div>

          <div className="shrink-0 border-t border-[#e5e5e5] bg-white py-3 pb-safe">
            {error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
            <div className="flex items-end gap-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Сообщение..."
                aria-label="Сообщение"
                rows={1}
                className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-[#dedede] bg-[#f7f7f7] px-4 py-3 text-sm text-[#202020] outline-none focus:border-[#ff5a82]"
              />
              <button
                onClick={sendMessage}
                disabled={!text.trim() || sending}
                aria-label="Отправить сообщение"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#4773d8] text-white disabled:opacity-40"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
          </div>
        </main>
      </div>
    </Layout>
  );
}
