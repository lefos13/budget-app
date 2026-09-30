import type { LucideIcon } from 'lucide-react';
import {
  Tag,
  Zap,
  ShoppingCart,
  Film,
  Home,
  Car,
  HeartPulse,
  Tv,
  Utensils,
  Heart,
  Coffee,
  Gift,
  Plane,
  Shirt,
} from 'lucide-react';

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Tag,
  Home,
  ShoppingCart,
  Utensils,
  Zap,
  Tv,
  Film,
  Car,
  HeartPulse,
  Heart,
  Coffee,
  Gift,
  Plane,
  Shirt,
};

export function getCategoryIcon(name?: string | null): LucideIcon {
  if (!name) return Tag;
  return CATEGORY_ICONS[name] || Tag;
}
