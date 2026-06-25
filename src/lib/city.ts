import { Model } from '@/types';

const AUTO_CITY_VALUES = new Set(['auto', 'авто', 'ауто']);

/** True for the placeholder city values admin/catalog-wide profiles are created with. */
export function isAutoCityValue(city: string | null | undefined): boolean {
  const raw = city?.trim().toLowerCase();
  return !!raw && AUTO_CITY_VALUES.has(raw);
}

/** Admin/catalog-wide profiles store city as a placeholder so every visitor
 * sees their own selected city instead of a literal value. */
export function resolveModelCity(model: Pick<Model, 'city'> | null | undefined, userCity: string | null): string | null {
  if (isAutoCityValue(model?.city)) return userCity;
  return model?.city ?? null;
}
