import { ModelChatMessage, SupportMessage } from '@/types';
import { CheckCheck, Download, FileText } from 'lucide-react';

type AnyMessage = ModelChatMessage | SupportMessage;

interface Props {
  message: AnyMessage;
  isOwn: boolean;
  /** Показать «хвостик»/якорь пузыря — false для соседних сообщений подряд от одного отправителя. */
  showTail?: boolean;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
}

function fileName(url: string): string {
  try {
    return decodeURIComponent(url.split('/').pop() ?? 'Файл').replace(/^\d+\./, '');
  } catch {
    return 'Файл';
  }
}

export default function ChatBubble({ message, isOwn, showTail = true }: Props) {
  const fileUrl = 'file_url' in message ? message.file_url : null;
  let filePath = fileUrl ?? '';
  try { filePath = fileUrl ? new URL(fileUrl).pathname : ''; } catch { /* keep raw path */ }
  const isImage = /\.(jpeg|jpg|gif|png|webp)$/i.test(filePath);

  return (
    <article className={`mb-1.5 flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[86%] px-3.5 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.05)] sm:max-w-[72%] lg:max-w-[66%] ${
          isOwn
            ? `bg-[#4773d8] text-white rounded-[18px] ${showTail ? 'rounded-br-[5px]' : 'rounded-br-[18px]'}`
            : `bg-white border border-[#e5e4e0] text-[#202020] rounded-[18px] ${showTail ? 'rounded-bl-[5px]' : 'rounded-bl-[18px]'}`
        }`}
      >
        {fileUrl && (
          isImage ? (
            <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="mb-2 block overflow-hidden rounded-xl bg-black/5">
              <img src={fileUrl} alt="Вложение" loading="lazy" className="max-h-64 w-full object-cover" />
            </a>
          ) : (
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`mb-2 flex items-center gap-2.5 rounded-xl p-2.5 text-xs font-medium transition-opacity hover:opacity-80 ${
                isOwn ? 'bg-white/15 text-white' : 'bg-[#f5f5f5] text-[#4773d8]'
              }`}
            >
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isOwn ? 'bg-white/15' : 'bg-white'}`}>
                <FileText size={15} />
              </span>
              <span className="min-w-0 flex-1 truncate">{fileName(fileUrl)}</span>
              <Download size={14} className="shrink-0" />
            </a>
          )
        )}
        {message.text && (
          <p className="select-text text-[14.5px] leading-relaxed whitespace-pre-wrap break-words">{message.text}</p>
        )}
        <span className={`mt-1 flex items-center justify-end gap-1 text-[10px] tracking-wide ${isOwn ? 'text-white/70' : 'text-[#989894]'}`}>
          {formatTime(message.created_at)} {isOwn && <CheckCheck size={12} aria-label={message.is_read ? 'Прочитано' : 'Доставлено'} className={message.is_read ? 'text-white' : 'text-white/55'} />}
        </span>
      </div>
    </article>
  );
}
