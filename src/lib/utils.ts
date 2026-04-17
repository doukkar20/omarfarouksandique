import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateReceiptNo(count: number): string {
  const year = new Date().getFullYear();
  const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${year}_${String(count + 1).padStart(4, '0')}_${randomSuffix}`;
}

export function generateHash(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}
