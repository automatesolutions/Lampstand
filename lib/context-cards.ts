import data from "@/content/context-cards.json";

export interface ContextCard {
  status: "draft" | "reviewed";
  author: string;
  date: string;
  audience: string;
  setting: string;
  purpose: string;
}

const cards = (data as { cards: Record<string, ContextCard> }).cards;

export function contextCard(book: string): ContextCard | undefined {
  return cards[book];
}
