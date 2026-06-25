import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ModelChatMessage } from '@/types';
import ChatBubble from '@/components/ChatBubble';
import Layout from '@/components/Layout';
import AuthModal from '@/components/AuthModal';
import OnlineDot from '@/components/OnlineDot';

export default function ModelChatPage() {
  const { modelId } = useParams<{ modelId: string }>();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [model, setModel] = useState<{ name?: string; photos?: string[]; code?: string; age?: number } | null>(null);
  const [messages, setMessages] = useState<ModelChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
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
    const { data } = await supabase.from('models').select('name, photos, code, age').eq('id', modelId).maybeSingle();
    setModel(data);
  };

  const fetchMessages = async () => {
    if (!session || !modelId) return;
    const { data } = await supabase
      .from('model_chats')
      .select('*')
      .eq('client_id', session.id)
      .eq('model_id', modelId)
      .order('created_at', { ascending: true });
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

  const sendMessage = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || !session || !modelId) return;
    setSending(true);
    setText('');
    await supabase.from('model_chats').insert({
      client_id: session.id,
      model_id: modelId,
      sender: 'client',
      text: trimmed,
      is_read: false,
    });
    setSending(false);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  if (!session) {
    return (
      <Layout hideNav>
        <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
          <p className="text-sand-400 text-sm mb-4">Войдите, чтобы написать модели</p>
          <button onClick={() => navigate(-1)} className="text-gold-500 text-xs tracking-widest uppercase">Назад</button>
        </div>
        {showAuth && <AuthModal onClose={() => navigate(-1)} onSuccess={() => setShowAuth(false)} />}
      </Layout>
    );
  }

  return (
    <Layout hideNav>
      <div className="flex flex-col h-dvh">
        <div className="pt-safe bg-ink-900/95 backdrop-blur-xl border-b border-white/[0.04] shrink-0">
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              onClick={() => navigate(-1)}
              aria-label="Назад"
              className="w-10 h-10 flex items-center justify-center rounded-lg bg-white/[0.04] border border-white/[0.07] text-sand-400 active:scale-90 transition-transform"
            >
              <ArrowLeft size={16} />
            </button>
            {model && (
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg overflow-hidden bg-ink-600">
                  {model.photos?.[0] && <img src={model.photos[0]} alt="" className="w-full h-full object-cover" />}
                </div>
                <div>
                  <p className="font-medium text-sm text-sand-100">{model.name}{model.age ? `, ${model.age}` : ''}</p>
                  <p className="text-xs text-gold-500 flex items-center gap-1.5"><OnlineDot />онлайн</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-6 h-px bg-gold-500/25 mx-auto mb-4" />
              <p className="text-sm text-sand-400">Начните диалог</p>
              <p className="text-xs text-sand-600 mt-1">Сообщения отправляются менеджеру модели</p>
            </div>
          )}
          {messages.map((msg) => (
            <ChatBubble key={msg.id} message={msg} isOwn={msg.sender === 'client'} />
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="shrink-0 px-4 py-3 bg-ink-900 border-t border-white/[0.04] pb-safe">
          <div className="flex items-end gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Сообщение..."
              aria-label="Сообщение"
              rows={1}
              className="flex-1 bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-3 text-sm text-sand-100 placeholder-sand-600 outline-none focus:border-gold-500/30 resize-none max-h-32 transition-all"
            />
            <button
              onClick={sendMessage}
              disabled={!text.trim() || sending}
              aria-label="Отправить сообщение"
              className="w-11 h-11 rounded-xl bg-gold-500 flex items-center justify-center active:scale-90 disabled:opacity-30 transition-all"
            >
              <Send size={15} className="text-ink-900" />
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
