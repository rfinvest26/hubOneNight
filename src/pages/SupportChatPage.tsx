import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Headphones, Paperclip, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { SupportMessage } from '@/types';
import ChatBubble from '@/components/ChatBubble';
import Layout from '@/components/Layout';
import AuthModal from '@/components/AuthModal';
import OnlineDot from '@/components/OnlineDot';

export default function SupportChatPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const realtimeOk = useRef(false);

  useEffect(() => {
    if (!session) { setShowAuth(true); setInitializing(false); return; }
    initChat();
  }, [session]);

  useEffect(() => {
    if (!chatId) return;
    fetchMessages();
    const unsub = subscribeRealtime(chatId);
    const interval = setInterval(() => { if (!realtimeOk.current) fetchMessages(); }, 5000);
    return () => { unsub(); clearInterval(interval); };
  }, [chatId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const initChat = async () => {
    if (!session) return;
    const { data: existing } = await supabase
      .from('support_chats')
      .select('id')
      .eq('client_id', session.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) setChatId(existing.id);
    setInitializing(false);
  };

  const ensureChatId = async (): Promise<string | null> => {
    if (chatId) return chatId;
    if (!session) return null;
    const insertData: Record<string, unknown> = { client_id: session.id, status: 'open' };
    if (session.worker_id) insertData.worker_id = session.worker_id;
    const { data } = await supabase.from('support_chats').insert(insertData).select('id').single();
    if (data) { setChatId(data.id); return data.id; }
    return null;
  };

  const fetchMessages = async () => {
    if (!chatId) return;
    const { data } = await supabase
      .from('support_messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });
    setMessages(data ?? []);
  };

  const subscribeRealtime = (cid: string) => {
    const channel = supabase
      .channel(`support_${cid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `chat_id=eq.${cid}` },
        (payload) => {
          realtimeOk.current = true;
          const msg = payload.new as SupportMessage;
          setMessages((prev) => prev.find((m) => m.id === msg.id) ? prev : [...prev, msg]);
        }
      )
      .subscribe((status) => { realtimeOk.current = status === 'SUBSCRIBED'; });
    return () => { supabase.removeChannel(channel); };
  };

  const sendMessage = async (e?: React.FormEvent, attachFile?: File) => {
    if (e) e.preventDefault();
    const trimmed = text.trim();
    if ((!trimmed && !attachFile) || sending || !session) return;
    setSending(true);
    if (!attachFile) setText('');

    const cid = await ensureChatId();
    if (!cid) { setSending(false); return; }

    let file_url = null;
    if (attachFile) {
      setUploading(true);
      const ext = attachFile.name.split('.').pop();
      const path = `support/${session.id}/${Date.now()}.${ext}`;
      await supabase.storage.from('public_photos').upload(path, attachFile);
      const { data } = supabase.storage.from('public_photos').getPublicUrl(path);
      file_url = data.publicUrl;
      setUploading(false);
    }

    const newMsg: SupportMessage = {
      id: crypto.randomUUID(),
      chat_id: cid,
      sender: 'client',
      text: trimmed,
      file_url,
      tg_message_id: null,
      is_read: false,
      created_at: new Date().toISOString()
    };

    setMessages((prev) => [...prev, newMsg]);

    await supabase.from('support_messages').insert({ 
      id: newMsg.id,
      chat_id: cid, 
      sender: 'client', 
      text: trimmed, 
      file_url,
      is_read: false 
    });
    setSending(false);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      sendMessage(undefined, file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  if (!session) {
    return (
      <Layout hideNav>
        <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
          <Headphones size={28} className="text-ink-200 mb-4" />
          <p className="text-sand-400 text-sm mb-4">Войдите, чтобы написать в поддержку</p>
          <button onClick={() => navigate(-1)} className="text-gold-500 text-xs tracking-widest uppercase">Назад</button>
        </div>
        {showAuth && <AuthModal onClose={() => navigate(-1)} onSuccess={() => setShowAuth(false)} />}
      </Layout>
    );
  }

  if (initializing) {
    return (
      <Layout hideNav>
        <div className="min-h-dvh flex items-center justify-center">
          <div className="w-5 h-5 rounded-full border border-gold-500/40 border-t-gold-500 animate-spin" />
        </div>
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
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-gold-500/10 border border-gold-500/15 flex items-center justify-center">
                <Headphones size={15} className="text-gold-500" />
              </div>
              <div>
                <p className="font-medium text-sm text-sand-100">Поддержка</p>
                <p className="text-xs text-gold-500 flex items-center gap-1.5"><OnlineDot />онлайн</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-6 h-px bg-gold-500/25 mx-auto mb-4" />
              <p className="text-sm text-sand-400">Напишите нам</p>
              <p className="text-xs text-sand-600 mt-1">Ответим в ближайшее время</p>
            </div>
          )}
          {messages.map((msg) => (
            <ChatBubble key={msg.id} message={msg} isOwn={msg.sender === 'client'} />
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="shrink-0 px-4 py-3 bg-ink-900 border-t border-white/[0.04] pb-safe">
          <div className="flex items-end gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={sending || uploading}
              aria-label="Прикрепить файл"
              className="w-11 h-11 shrink-0 rounded-xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center text-sand-400 hover:text-gold-500 hover:border-gold-500/30 active:scale-90 transition-all disabled:opacity-50"
            >
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
            </button>
            <input type="file" ref={fileInputRef} onChange={handleFile} className="hidden" accept="image/*,application/pdf" aria-label="Файл вложения" />
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Сообщение поддержке..."
              aria-label="Сообщение поддержке"
              rows={1}
              className="flex-1 bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-3 text-sm text-sand-100 placeholder-sand-600 outline-none focus:border-gold-500/30 resize-none max-h-32 transition-all"
            />
            <button
              onClick={() => sendMessage()}
              disabled={!text.trim() || sending}
              aria-label="Отправить сообщение"
              className="w-11 h-11 shrink-0 rounded-xl bg-gold-500 flex items-center justify-center active:scale-90 disabled:opacity-30 transition-all"
            >
              <Send size={15} className="text-ink-900" />
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
