export const PEOPLE = ["Elephant", "Labubu", "Alpaca"] as const;

export type Person = (typeof PEOPLE)[number];
