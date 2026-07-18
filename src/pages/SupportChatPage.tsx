import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Headphones, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { SupportMessage } from '@/types';
import { ensureOpenSupportChat } from '@/lib/supportChat';
import { groupMessagesForDisplay, mergeMessagesById } from '@/lib/chatGrouping';
import AuthModal from '@/components/AuthModal';
import ChatBubble from '@/components/ChatBubble';
import ChatHeader from '@/components/ChatHeader';
import ChatComposer from '@/components/ChatComposer';
import ChatViewport from '@/components/ChatViewport';
import Layout from '@/components/Layout';
import { useChatScroll } from '@/hooks/useChatScroll';

const SUPPORT_FILE_LIMIT = 10 * 1024 * 1024;
const SUPPORT_FILE_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const SUPPORT_FILE_EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

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
  const realtimeOk = useRef(false);
  const { scrollRef, contentRef, handleScroll, scrollToBottom, hasNewMessages } = useChatScroll(messages.length);

  useEffect(() => {
    if (!session) {
      setShowAuth(true);
      setInitializing(false);
      return;
    }
    setChatId(null);
    setMessages([]);
    setInitializing(true);
    initChat();
  }, [session]);

  useEffect(() => {
    if (!chatId) return;
    realtimeOk.current = false;
    fetchMessages();
    const unsub = subscribeRealtime(chatId);
    const interval = setInterval(() => { if (!realtimeOk.current) fetchMessages(); }, 5000);
    return () => { unsub(); clearInterval(interval); };
  }, [chatId]);

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
      .order('created_at', { ascending: false })
      .limit(300);
    if (msgError) {
      console.error('Support messages fetch error:', msgError);
      setError('Не удалось обновить сообщения. Проверьте соединение.');
      return;
    }
    setMessages((current) => mergeMessagesById(current, data ? [...data].reverse() : []));
  };

  const subscribeRealtime = (cid: string) => {
    const channel = supabase
      .channel(`support_${cid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `chat_id=eq.${cid}` },
        (payload) => {
          realtimeOk.current = true;
          const msg = payload.new as SupportMessage;
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

  const sendMessage = async (e?: React.FormEvent, attachFile?: File) => {
    if (e) e.preventDefault();
    const trimmed = text.trim();
    if ((!trimmed && !attachFile) || sending || !session) return;
    setError('');
    setSending(true);
    setText('');

    let optimisticId: string | null = null;
    try {
      const cid = await ensureChatId();
      if (!cid) {
        setText(trimmed);
        return;
      }

      let file_url: string | null = null;
      if (attachFile) {
        setUploading(true);
        const ext = SUPPORT_FILE_EXTENSIONS[attachFile.type];
        const path = `support/${session.id}/${generateUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('public_photos').upload(path, attachFile, {
          contentType: attachFile.type,
          upsert: false,
        });
        if (uploadError) throw uploadError;
        file_url = supabase.storage.from('public_photos').getPublicUrl(path).data.publicUrl;
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
      optimisticId = newMsg.id;
      setMessages((prev) => mergeMessagesById(prev, [newMsg]));

      const { error: insertError } = await supabase.from('support_messages').insert({
        id: newMsg.id,
        chat_id: cid,
        sender: 'client',
        text: trimmed,
        file_url,
        is_read: false,
      });
      if (insertError) throw insertError;
      requestAnimationFrame(() => scrollToBottom('smooth'));
    } catch (sendError) {
      console.error('Support message send error:', sendError);
      if (optimisticId) setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId));
      setError(attachFile ? 'Не удалось отправить вложение. Попробуйте ещё раз.' : 'Сообщение не отправлено. Попробуйте ещё раз.');
      setText(trimmed);
    } finally {
      setUploading(false);
      setSending(false);
    }
  };

  const handleFile = (file: File) => {
    if (file.size > SUPPORT_FILE_LIMIT) {
      setError('Файл слишком большой. Максимальный размер — 10 МБ.');
      return;
    }
    if (!SUPPORT_FILE_TYPES.has(file.type)) {
      setError('Можно отправить JPG, PNG, WEBP, GIF или PDF.');
      return;
    }
    void sendMessage(undefined, file);
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
    <ChatViewport
      header={
        <ChatHeader
          onBack={() => navigate('/profile?tab=support')}
          avatar={
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#4773d8] text-white">
              <Headphones size={19} />
            </div>
          }
          title="Поддержка"
          status="онлайн"
        />
      }
      composer={
        <ChatComposer
          text={text}
          onTextChange={setText}
          onSend={() => sendMessage()}
          onFileSelect={handleFile}
          placeholder="Сообщение поддержке"
          busy={sending}
          uploading={uploading}
          error={error}
          onFocus={() => setTimeout(() => scrollToBottom('smooth'), 120)}
        />
      }
      scrollRef={scrollRef}
      contentRef={contentRef}
      onScroll={handleScroll}
      hasNewMessages={hasNewMessages}
      onShowLatest={() => scrollToBottom('smooth')}
    >
            {messages.length === 0 && (
              <div className="mx-auto my-auto w-full max-w-md rounded-[20px] border border-[#dfded9] bg-white p-6 text-center text-[#202020] shadow-[0_14px_38px_rgba(30,30,28,0.06)]">
                <ShieldCheck size={28} className="mx-auto mb-3 text-[#4773d8]" />
                <p className="text-xl font-black">Напишите в поддержку</p>
                <p className="mt-2 text-sm text-[#777]">Здесь подтверждаются заказы, подписки и вопросы по оплате.</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {['Статус моего заказа', 'Как проходит оплата?', 'Хочу оформить подписку'].map((question) => (
                    <button
                      key={question}
                      type="button"
                      onClick={() => setText(question)}
                      className="rounded-lg bg-[#f1f1f1] px-3.5 py-2 text-sm font-medium text-[#444] transition-colors hover:bg-[#e8eefc] hover:text-[#315aad]"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            )}
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
