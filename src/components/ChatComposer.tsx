import { FormEvent, KeyboardEvent, useLayoutEffect, useRef } from 'react';
import { AlertCircle, Loader2, Paperclip, Send } from 'lucide-react';

interface Props {
  text: string;
  onTextChange: (value: string) => void;
  onSend: () => void | Promise<void>;
  placeholder: string;
  busy?: boolean;
  uploading?: boolean;
  error?: string;
  disabled?: boolean;
  onFocus?: () => void;
  onFileSelect?: (file: File) => void | Promise<void>;
  fileAccept?: string;
}

const MAX_MESSAGE_LENGTH = 2000;

export default function ChatComposer({
  text,
  onTextChange,
  onSend,
  placeholder,
  busy = false,
  uploading = false,
  error = '',
  disabled = false,
  onFocus,
  onFileSelect,
  fileAccept = 'image/*,application/pdf',
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = '0px';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  }, [text]);

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (!text.trim() || busy || uploading || disabled) return;
    void onSend();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    submit();
  };

  const handleFile = (file: File | undefined) => {
    if (file && onFileSelect) void onFileSelect(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const locked = busy || uploading || disabled;
  return (
    <form onSubmit={submit} className="chat-composer" aria-label="Новое сообщение">
      {error && (
        <div role="alert" className="chat-error">
          <AlertCircle size={16} /> <span>{error}</span>
        </div>
      )}
      <div className="chat-composer-row">
        {onFileSelect && (
          <>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={locked}
              aria-label="Прикрепить файл"
              className="chat-tool-button"
            >
              {uploading ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18} />}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept={fileAccept}
              onChange={(event) => handleFile(event.target.files?.[0])}
              className="hidden"
              tabIndex={-1}
            />
          </>
        )}
        <div className="chat-input-wrap">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(event) => onTextChange(event.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={onFocus}
            placeholder={placeholder}
            aria-label={placeholder}
            rows={1}
            maxLength={MAX_MESSAGE_LENGTH}
            enterKeyHint="send"
            disabled={disabled}
            className="chat-input"
          />
          {text.length > 1700 && <span className="chat-character-count">{text.length}/{MAX_MESSAGE_LENGTH}</span>}
        </div>
        <button
          type="submit"
          disabled={!text.trim() || locked}
          aria-label="Отправить сообщение"
          className="chat-send-button"
        >
          {busy ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </div>
    </form>
  );
}
