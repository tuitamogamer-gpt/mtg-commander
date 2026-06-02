// Card data model — mirrors a trimmed subset of the Scryfall card object.

export interface CardImageUris {
  small?: string;
  normal?: string;
  large?: string;
  png?: string;
  art_crop?: string;
  border_crop?: string;
}

/**
 * A single card face. Most cards have one face; double-faced / split / adventure
 * cards have two. Scryfall puts per-face image_uris on `card_faces` for some layouts.
 */
export interface CardFace {
  name: string;
  manaCost?: string;
  typeLine?: string;
  oracleText?: string;
  power?: string;
  toughness?: string;
  loyalty?: string;
  imageUris?: CardImageUris;
}

export interface Card {
  scryfallId: string;
  oracleId?: string;
  name: string;
  manaCost?: string;
  cmc?: number;
  typeLine?: string;
  oracleText?: string;
  colors?: string[];
  colorIdentity?: string[];
  power?: string;
  toughness?: string;
  loyalty?: string;
  layout?: string;
  setCode?: string;
  collectorNumber?: string;
  rarity?: string;
  imageUris?: CardImageUris;
  cardFaces?: CardFace[];
  /** Scryfall page for the card (rulings / legalities). */
  scryfallUri?: string;
}

export interface CardBatchRequest {
  ids: string[];
}

export interface CardBatchResponse {
  cards: Card[];
  /** Ids that could not be resolved. */
  notFound: string[];
}
