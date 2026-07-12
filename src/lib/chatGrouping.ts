/** Общая раскладка чата: разделители по дням + скрытие «хвостика» у подряд идущих сообщений одного отправителя. */

interface Groupable {
  id: string;
  sender: string;
  created_at: string;
}

export type ChatDisplayItem<T> =
  | { type: 'divider'; key: string; label: string }
  | { type: 'message'; key: string; message: T; showTail: boolean };

function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(date, today)) return 'Сегодня';
  if (sameDay(date, yesterday)) return 'Вчера';
  return date.toLocaleDateString('ru', { day: 'numeric', month: 'long', year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
}

/** Хвостик прячем, если следующее сообщение — тот же отправитель в пределах 2 минут. */
const TAIL_GROUP_WINDOW_MS = 2 * 60 * 1000;

export function groupMessagesForDisplay<T extends Groupable>(messages: T[]): ChatDisplayItem<T>[] {
  const items: ChatDisplayItem<T>[] = [];
  let lastDayKey = '';

  messages.forEach((message, idx) => {
    const dateKey = new Date(message.created_at).toDateString();
    if (dateKey !== lastDayKey) {
      items.push({ type: 'divider', key: `divider-${dateKey}`, label: dayLabel(message.created_at) });
      lastDayKey = dateKey;
    }

    const next = messages[idx + 1];
    const sameNextSender = next && next.sender === message.sender && dateKey === new Date(next.created_at).toDateString();
    const closeInTime = next && new Date(next.created_at).getTime() - new Date(message.created_at).getTime() < TAIL_GROUP_WINDOW_MS;
    const showTail = !(sameNextSender && closeInTime);

    items.push({ type: 'message', key: message.id, message, showTail });
  });

  return items;
}
