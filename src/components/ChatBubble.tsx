import { motion } from 'framer-motion';
import { ModelChatMessage, SupportMessage } from '@/types';
import { Download, FileText } from 'lucide-react';

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
  const isImage = fileUrl && fileUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-1.5`}
    >
      <div
        className={`max-w-[80%] sm:max-w-[65%] px-4 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.06)] ${
          isOwn
            ? `bg-[#4773d8] text-white rounded-2xl ${showTail ? 'rounded-br-md' : 'rounded-br-2xl'}`
            : `bg-white border border-[#eaeaea] text-[#202020] rounded-2xl ${showTail ? 'rounded-bl-md' : 'rounded-bl-2xl'}`
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
        <span className={`text-[10px] mt-1 block text-right tracking-wide ${isOwn ? 'text-white/70' : 'text-[#a3a3a3]'}`}>
          {formatTime(message.created_at)}
        </span>
      </div>
    </motion.div>
  );
}
