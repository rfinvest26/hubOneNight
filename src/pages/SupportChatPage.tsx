import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Headphones, Loader2, Paperclip, Send, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { SupportMessage } from '@/types';
import { ensureOpenSupportChat } from '@/lib/supportChat';
import { groupMessagesForDisplay } from '@/lib/chatGrouping';
import AuthModal from '@/components/AuthModal';
import ChatBubble from '@/components/ChatBubble';
import ChatHeader from '@/components/ChatHeader';
import Layout from '@/components/Layout';

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
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const realtimeOk = useRef(false);

  useEffect(() => {
    if (!session) {
      setShowAuth(true);
      setInitializing(false);
      return;
    }
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
    const { data, error: chatError } = await supabase
      .from('support_chats')
      .select('id')
      .eq('client_id', session.id)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (chatError) console.error('Support chat init error:', chatError);
    if (data?.id) setChatId(data.id);
    setInitializing(false);
  };

  const ensureChatId = async (): Promise<string | null> => {
    if (chatId) return chatId;
    if (!session) return null;
    const id = await ensureOpenSupportChat(session.id, session.worker_id);
    if (!id) {
      setError('Не удалось открыть чат поддержки. Попробуйте ещё раз.');
      return null;
    }
    setChatId(id);
    return id;
  };

  const fetchMessages = async () => {
    if (!chatId) return;
    const { data, error: msgError } = await supabase
      .from('support_messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });
    if (msgError) console.error('Support messages fetch error:', msgError);
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

  const sendMessage = async (e?: React.FormEvent, attachFile?: File) => {
    if (e) e.preventDefault();
    const trimmed = text.trim();
    if ((!trimmed && !attachFile) || sending || !session) return;
    setError('');
    setSending(true);
    if (!attachFile) setText('');

    const cid = await ensureChatId();
    if (!cid) { setSending(false); return; }

    let file_url: string | null = null;
    if (attachFile) {
      setUploading(true);
      const ext = attachFile.name.split('.').pop() || 'file';
      const path = `support/${session.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('public_photos').upload(path, attachFile);
      if (uploadError) {
        console.error('Support file upload error:', uploadError);
        setError('Не удалось загрузить файл.');
        setUploading(false);
        setSending(false);
        return;
      }
      file_url = supabase.storage.from('public_photos').getPublicUrl(path).data.publicUrl;
      setUploading(false);
    }

    const newMsg: SupportMessage = {
      id: generateUUID(),
      chat_id: cid,
      sender: 'client',
      text: trimmed,
      file_url,
      tg_message_id: null,
      is_read: false,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, newMsg]);

    const { error: insertError } = await supabase.from('support_messages').insert({
      id: newMsg.id,
      chat_id: cid,
      sender: 'client',
      text: trimmed,
      file_url,
      is_read: false,
    });
    if (insertError) {
      console.error('Support message insert error:', insertError);
      setError('Сообщение не отправлено. Попробуйте ещё раз.');
      setMessages((prev) => prev.filter((msg) => msg.id !== newMsg.id));
    }
    setSending(false);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) sendMessage(undefined, file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const displayItems = useMemo(() => groupMessagesForDisplay(messages), [messages]);

  if (!session) {
    return (
      <Layout>
        <div className="min-h-[70dvh] bg-white text-[#202020] flex items-center justify-center px-5">
          <div className="max-w-sm text-center">
            <Headphones size={34} className="mx-auto mb-4 text-[#ff5a82]" />
            <h1 className="text-3xl font-black">Войдите, чтобы написать в поддержку</h1>
            <button onClick={() => setShowAuth(true)} className="mt-6 h-12 rounded-lg bg-[#ff5a82] px-6 font-semibold text-white">Войти</button>
          </div>
          {showAuth && <AuthModal onClose={() => navigate(-1)} onSuccess={() => setShowAuth(false)} />}
        </div>
      </Layout>
    );
  }

  if (initializing) {
    return (
      <Layout>
        <div className="min-h-[70dvh] bg-white flex items-center justify-center">
          <div className="h-9 w-9 animate-spin rounded-full border border-[#ff5a82]/25 border-t-[#ff5a82]" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout hideNav>
      <div className="flex h-dvh flex-col bg-[#202020] md:bg-[#f6f6f6]">
        <ChatHeader
          onBack={() => navigate(-1)}
          avatar={
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#ff5a82] text-white">
              <Headphones size={19} />
            </div>
          }
          title="Поддержка"
          status="онлайн"
        />

        <main className="flex min-h-0 w-full flex-1 flex-col bg-[#f6f6f6]">
          <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col px-4 md:px-6">
          <div className="flex-1 overflow-y-auto py-5">
            {messages.length === 0 && (
              <div className="mx-auto mt-16 max-w-md rounded-[18px] border border-[#e5e5e5] bg-white p-6 text-center text-[#202020] shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
                <ShieldCheck size={28} className="mx-auto mb-3 text-[#ff5a82]" />
                <p className="text-xl font-black">Напишите в поддержку</p>
                <p className="mt-2 text-sm text-[#777]">Здесь подтверждаются заказы, подписки и вопросы по оплате.</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {['Статус моего заказа', 'Как проходит оплата?', 'Хочу оформить подписку'].map((question) => (
                    <button
                      key={question}
                      type="button"
                      onClick={() => setText(question)}
                      className="rounded-lg bg-[#f1f1f1] px-3.5 py-2 text-sm font-medium text-[#444] transition-colors hover:bg-[#ffe4ed] hover:text-[#ff4f80]"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {displayItems.map((item) =>
              item.type === 'divider' ? (
                <div key={item.key} className="my-3 flex items-center justify-center">
                  <span className="rounded-full bg-black/[0.06] px-3 py-1 text-[11px] font-semibold text-[#666]">{item.label}</span>
                </div>
              ) : (
                <ChatBubble key={item.key} message={item.message} isOwn={item.message.sender === 'client'} showTail={item.showTail} />
              )
            )}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={sendMessage} className="shrink-0 border-t border-[#e5e5e5] bg-white py-3 pb-safe">
            {error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={sending || uploading}
                aria-label="Прикрепить файл"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#e2e2e2] bg-[#f7f7f7] text-[#555] transition-colors hover:bg-[#f0f0f0] disabled:opacity-50"
              >
                {uploading ? <Loader2 size={17} className="animate-spin" /> : <Paperclip size={17} />}
              </button>
              <input type="file" ref={fileInputRef} onChange={handleFile} className="hidden" accept="image/*,application/pdf" aria-label="Файл вложения" />
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Сообщение поддержке..."
                aria-label="Сообщение поддержке"
                rows={1}
                className="max-h-32 min-h-12 flex-1 resize-none rounded-2xl border border-[#e2e2e2] bg-[#f7f7f7] px-4 py-3.5 text-[15px] text-[#202020] outline-none transition-colors focus:border-[#ff5a82] focus:bg-white"
              />
              <button
                type="submit"
                disabled={!text.trim() || sending}
                aria-label="Отправить сообщение"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#4773d8] text-white transition-transform active:scale-95 disabled:opacity-40"
              >
                <Send size={17} />
              </button>
            </div>
          </form>
          </div>
        </main>
      </div>
    </Layout>
  );
}
