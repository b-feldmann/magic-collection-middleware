import { ObjectId } from 'mongodb';
import express from 'express';

import CardInterface from '../interfaces/CardInterface';
import { CardMainType, CardState, RarityType } from '../interfaces/enums';

const cardRouter = express.Router();

const COLLECTION_CARDS = 'cards';
const EMPTY_CARD = (): CardInterface => ({
  name: '',
  front: {
    name: '',
    cardMainType: CardMainType.Creature,
    cardText: [],
  },
  manaCost: '',
  rarity: RarityType.Common,
  meta: {
    comment: '',
    likes: [],
    dislikes: [],
    lastUpdated: Date.now(),
    createdAt: Date.now(),
    state: CardState.Draft,
  },
});

const createCardRouter = (dbase) => {
  cardRouter.get('/', async (req, res) => {
    if (req.query.accessKey !== process.env.ACCESS_KEY) {
      res.sendStatus(401);
      return;
    }

    try {
      const results = await dbase.collection(COLLECTION_CARDS).find().toArray();

      const returnedCards = results.map((single) => {
        const { _id, ...card }: { card: CardInterface; _id: string } = single;
        return { ...card, uuid: _id };
      });

      res.send({ cards: returnedCards });
    } catch (err) {
      console.log(err);
      res.sendStatus(500);
    }
  });

  cardRouter.post('/', async (req, res) => {
    if (req.body.accessKey !== process.env.ACCESS_KEY) {
      res.sendStatus(401);
      return;
    }

    try {
      const newCard = EMPTY_CARD();
      newCard.creator = req.body.creator;
      const result = await dbase.collection(COLLECTION_CARDS).insertOne(newCard);
      const createdCard = { ...newCard, uuid: result.insertedId };
      res.send({ card: createdCard });
    } catch (err) {
      console.log(err);
      res.sendStatus(500);
    }
  });

  cardRouter.put('/', async (req, res) => {
    if (req.body.accessKey !== process.env.ACCESS_KEY) {
      res.sendStatus(401);
      return;
    }

    try {
      const { uuid, ...card } = req.body.card;
      card.meta.lastUpdated = Date.now();

      await dbase
        .collection(COLLECTION_CARDS)
        .replaceOne({ _id: new ObjectId(uuid) }, { ...card }, { upsert: true });

      res.send({ card: { ...card, uuid } });
    } catch (err) {
      console.log(err);
      res.sendStatus(500);
    }
  });

  return cardRouter;
};

export default createCardRouter;
