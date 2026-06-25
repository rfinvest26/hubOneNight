export interface ClientSession {
  id: string;
  email: string;
  username: string | null;
  city: string | null;
  worker_id: number | null;
  role: string;
}

export interface Model {
  id: string;
  code: string;
  worker_id: number;
  name: string;
  age: number | null;
  city: string | null;
  height: number | null;
  weight: number | null;
  description: string | null;
  services: string[];
  photos: string[];
  catalog_visible: boolean;
  active: boolean;
  rating: number;
  price: number | null;
  orders_count: number;
  funds_amount: number;
  public_comments: string[];
  source: string;
  worker_username: string | null;
  created_at: string;
}

export interface Order {
  id: string;
  client_id: string;
  model_id: string;
  worker_id: number;
  status: string;
  price: number | null;
  order_date: string | null;
  order_time: string | null;
  duration: string | null;
  location: string | null;
  services: string | null;
  comment: string | null;
  payment_method: 'online' | 'cash';
  created_at: string;
}

export const CASH_PAYMENT_UNLOCK_ORDERS = 3;

export interface ModelChatMessage {
  id: string;
  client_id: string;
  model_id: string;
  sender: 'client' | 'model';
  text: string;
  is_read: boolean;
  created_at: string;
}

export interface SupportMessage {
  id: string;
  chat_id: string;
  sender: 'client' | 'admin';
  text: string;
  tg_message_id: number | null;
  file_url?: string | null;
  is_read: boolean;
  created_at: string;
}

export interface SupportChat {
  id: string;
  client_id: string;
  worker_id: number;
  tg_thread_id: number | null;
  status: 'open' | 'closed';
  created_at: string;
  updated_at: string;
}

export interface PromoCode {
  id: string;
  worker_id: number;
  code: string;
  discount: number;
  expiry: string | null;
  usage_limit: number | null;
  uses_count: number;
  created_at: string;
}

export interface Favorite {
  id: string;
  client_id: string;
  model_id: string;
  created_at: string;
  models?: Model;
}

export interface FilterState {
  city: string;
  ageMin: number;
  ageMax: number;
  heightMin: number;
  heightMax: number;
  weightMin: number;
  weightMax: number;
  services: string[];
}

export const COUNTRY_LABELS: Record<string, string> = {
  ru: 'Россия',
  ua: 'Украина',
  by: 'Беларусь',
  kz: 'Казахстан',
  uz: 'Узбекистан',
  kg: 'Киргизия',
  tj: 'Таджикистан',
  am: 'Армения',
  az: 'Азербайджан',
  md: 'Молдова',
  ge: 'Грузия',
};

export const AVAILABLE_SERVICES = [
  'Классика',
  'Эскорт',
  'Массаж',
  'Ролевые игры',
  'Выезд',
  'Апартаменты',
  'Оральные',
  'Компаньонка',
];

export const DURATION_OPTIONS = [
  { label: '1 час', value: '1 час' },
  { label: '2 часа', value: '2 часа' },
  { label: '3 часа', value: '3 часа' },
  { label: 'Ночь', value: 'Ночь' },
];
