import { ModelChatMessage, SupportMessage } from '@/types';
import { Download } from 'lucide-react';

type AnyMessage = ModelChatMessage | SupportMessage;

interface Props {
  message: AnyMessage;
  isOwn: boolean;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
}

export default function ChatBubble({ message, isOwn }: Props) {
  const fileUrl = (message as any).file_url;
  const isImage = fileUrl && fileUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i);

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-1.5`}>
      <div
        className={`max-w-[78%] px-4 py-2.5 ${
          isOwn
            ? 'bg-gold-500 text-ink-900 rounded-2xl rounded-br-sm'
            : 'bg-ink-500 border border-white/[0.06] text-sand-100 rounded-2xl rounded-bl-sm'
        }`}
      >
        {fileUrl && (
          <div className="mb-2 overflow-hidden rounded-xl bg-black/10 border border-white/5">
            {isImage ? (
              <img src={fileUrl} alt="Вложение" loading="lazy" className="w-full h-auto object-cover max-h-48" />
            ) : (
              <a href={fileUrl} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 p-3 text-xs font-medium hover:opacity-80 transition-opacity ${isOwn ? 'text-ink-900' : 'text-gold-500'}`}>
                <Download size={14} /> Вложение
              </a>
            )}
          </div>
        )}
        {message.text && (
          <p className="select-text text-sm leading-relaxed whitespace-pre-wrap break-words">{message.text}</p>
        )}
        <span className={`text-[10px] mt-0.5 block text-right tracking-wide ${isOwn ? 'text-ink-900/50' : 'text-sand-600'}`}>
          {formatTime(message.created_at)}
        </span>
      </div>
    </div>
  );
}
