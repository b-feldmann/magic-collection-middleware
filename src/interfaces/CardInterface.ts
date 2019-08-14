import CardFaceInterface from './CardFaceInterface';
import { CardVersion, RarityType } from './enums';

export default interface CardInterface {
  [key: string]: number | string | CardFaceInterface | boolean | undefined;
  uuid?: string;
  name: string;
  rarity: RarityType;
  creator?: string;
  manaCost: string;
  front: CardFaceInterface;
  back?: CardFaceInterface;
  version: CardVersion;
  loading?: boolean;
}
