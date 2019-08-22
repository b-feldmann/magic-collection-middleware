import CardFaceInterface from './CardFaceInterface';
import { CardState, RarityType } from './enums';

export interface CardMeta {
  comment: string;
  likes: string[];
  dislikes: string[];
  lastUpdated: number;
  createdAt: number;
  state: CardState;
}

export default interface CardInterface {
  [key: string]: number | string | CardFaceInterface | CardMeta | boolean | undefined;
  uuid?: string;
  name: string;
  rarity: RarityType;
  creator?: string;
  manaCost: string;
  front: CardFaceInterface;
  back?: CardFaceInterface;
  meta: CardMeta;
}
