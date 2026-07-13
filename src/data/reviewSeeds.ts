export interface SeededReview {
  id: string;
  author: string;
  comment: string;
  rating: number;
  createdAt: string;
}

const REVIEWERS = [
  'Александр', 'Михаил', 'Артём', 'Даниил', 'Роман', 'Илья',
  'Максим', 'Кирилл', 'Никита', 'Владислав', 'Антон', 'Сергей',
  'Егор', 'Дмитрий', 'Андрей', 'Константин',
];

const COMMENTS = [
  'Всё совпало с анкетой. Встретились вовремя, общение было лёгким и без неловкости.',
  'Очень приятная и тактичная девушка. Детали заранее обсудили в чате, поэтому всё прошло спокойно.',
  'Фотографии актуальные, образ полностью соответствует. Особенно понравилось внимательное отношение.',
  'Заказывал встречу вечером. Быстро договорились по времени, никаких неожиданных изменений не было.',
  'Хорошо чувствует настроение и умеет поддержать разговор. Остались только приятные впечатления.',
  'Аккуратная, пунктуальная и доброжелательная. Формат встречи обсудили заранее, всё было понятно.',
  'Первый раз пользовался сервисом. Поддержка помогла с оформлением, а встреча прошла лучше ожиданий.',
  'Понравилась естественность в общении. Без спешки, лишнего пафоса и формального отношения.',
  'Выбирал по отзывам и не пожалел. Уютная атмосфера и очень внимательное отношение к деталям.',
  'Встречались на выезде. Приехала точно ко времени, выглядела так же, как на фотографиях.',
  'Отдельный плюс за деликатность и спокойное общение. Хотелось отдохнуть после сложной недели — получилось.',
  'Согласовали всё за несколько сообщений. Понравилось, что на вопросы отвечала прямо и без долгого ожидания.',
  'Очень ухоженная и лёгкая в общении. Время пролетело незаметно, обязательно обращусь ещё раз.',
  'Анкета составлена честно: внешность, характер и формат встречи соответствуют описанию.',
  'Бронировал заранее на выходные. Подтверждение получил быстро, встреча началась без задержек.',
  'Спокойная атмосфера и уважительное отношение. Именно такой формат я и искал.',
  'Понравилось внимание к пожеланиям. Всё обсудили до встречи и не пришлось ничего уточнять на месте.',
  'Остались хорошие впечатления от общения и организации. Могу уверенно рекомендовать.',
];

function hash(value: string): number {
  let result = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    result ^= value.charCodeAt(i);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function seededIndex(seed: string, length: number): number {
  return length ? hash(seed) % length : 0;
}

export function seededReviewerName(seed: string): string {
  return REVIEWERS[seededIndex(seed, REVIEWERS.length)]!;
}

/** Stable per-model variety: it looks random, but cards do not jump on rerender. */
export function buildSeededReviews(
  modelCode: string,
  publicComments: string[] = [],
  count = 6,
): SeededReview[] {
  const custom = publicComments.map((comment) => comment.trim()).filter(Boolean);
  const available = [...custom, ...COMMENTS.filter((comment) => !custom.includes(comment))];
  const used = new Set<number>();
  const result: SeededReview[] = [];

  for (let i = 0; i < Math.min(count, available.length); i += 1) {
    let index = seededIndex(`${modelCode}:comment:${i}`, available.length);
    while (used.has(index)) index = (index + 1) % available.length;
    used.add(index);

    const dayOffset = 8 + seededIndex(`${modelCode}:date:${i}`, 150);
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - dayOffset);
    const rating = seededIndex(`${modelCode}:rating:${i}`, 5) === 0 ? 4 : 5;

    result.push({
      id: `seed-${modelCode}-${i}`,
      author: seededReviewerName(`${modelCode}:author:${i}`),
      comment: available[index]!,
      rating,
      createdAt: date.toISOString(),
    });
  }

  return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
