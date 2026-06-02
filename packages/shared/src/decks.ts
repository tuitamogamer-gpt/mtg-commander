// Deck + precon data models and import contracts.

export type DeckSource = "moxfield" | "precon" | "manual";

export interface DeckCardEntry {
  scryfallId: string;
  /** Card name kept denormalized so a deck list renders without a card lookup. */
  name: string;
  quantity: number;
  isCommander: boolean;
}

export interface Deck {
  id: string;
  userId: string;
  name: string;
  /** Display name(s) of the commander(s), comma-joined. */
  commander: string | null;
  cards: DeckCardEntry[];
  source: DeckSource;
  /** Moxfield public id or precon id this deck was imported from. */
  sourceId: string | null;
  colorIdentity: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateDeckInput {
  name: string;
  cards: DeckCardEntry[];
  source?: DeckSource;
  sourceId?: string | null;
}

export interface UpdateDeckInput {
  name?: string;
  cards?: DeckCardEntry[];
}

export interface MoxfieldImportInput {
  /** Either the public deck id or a full moxfield deck URL. */
  deckId: string;
}

/** Precon (preconstructed Commander deck) stored separately from user decks. */
export interface PreconDeck {
  id: string;
  name: string;
  setCode: string;
  /** Commander display name(s), comma-joined. */
  commanders: string;
  colorIdentity: string[];
  cards: DeckCardEntry[];
  releaseDate: string | null;
}

export interface PreconListItem {
  id: string;
  name: string;
  setCode: string;
  commanders: string;
  colorIdentity: string[];
  cardCount: number;
  releaseDate: string | null;
}

export interface PreconListQuery {
  setCode?: string;
  /** Color identity letters, e.g. "WUB". Matches decks that are within this identity. */
  colors?: string;
  /** Free-text search over name + commander. */
  search?: string;
}

/** Result of validating a deck as a legal Commander deck (advisory, not enforced in game). */
export interface DeckValidation {
  valid: boolean;
  cardCount: number;
  errors: string[];
  warnings: string[];
}
