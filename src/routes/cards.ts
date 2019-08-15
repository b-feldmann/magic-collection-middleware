import { ObjectID } from 'mongodb';

import express from 'express';

import CardInterface from '../interfaces/CardInterface';
import { CardMainType, CardVersion, Creators, RarityType } from '../interfaces/enums';

import moment = require('moment');

const cardRouter = express.Router();

const COLLECTION_CARDS = 'cards';
const EMPTY_CARD = (): CardInterface => ({
  name: '',
  front: {
    name: '',
    cardMainType: CardMainType.Creature,
    cardText: []
  },
  manaCost: '',
  rarity: RarityType.Common,
  creator: Creators.UNKNOWN,
  version: CardVersion.V1,
  lastUpdated: moment()
});

const removeUuid = card => {
  const { uuid, ...rest } = card;
  return { ...rest };
};

const createCardRouter = dbase => {
  cardRouter.get('/', function(req, res) {
    dbase
      .collection(COLLECTION_CARDS)
      .find()
      .toArray((err, results) => {
        if (err) {
          throw err;
        }

        const returnedCards = results.map(single => {
          const { _id, ...card }: { card: CardInterface; _id: string } = single;
          return { ...card, uuid: _id };
        });

        res.send({ cards: returnedCards });
      });
  });

  cardRouter.post('/', (req, res, next) => {
    if (req.body.accessKey !== process.env.ACCESS_KEY) return;

    const newCard = req.body.card ? removeUuid(req.body.card) : EMPTY_CARD();
    newCard.lastUpdated = moment();
    dbase.collection(COLLECTION_CARDS).insertOne(newCard, (err, result) => {
      if (err) {
        throw err;
      }

      const { _id, ...card }: { card: CardInterface; _id: string } = result.ops[0];
      const createdCard = { ...card, uuid: _id };
      res.send({ card: createdCard });
    });
  });

  cardRouter.put('/', (req, res, next) => {
    if (req.body.accessKey !== process.env.ACCESS_KEY) return;

    const { uuid, ...card } = req.body.card;
    card.lastUpdated = moment();

    dbase
      .collection(COLLECTION_CARDS)
      .replaceOne({ _id: ObjectID(uuid) }, { ...card }, { upsert: true }, (err, result) => {
        if (err) {
          throw err;
        }

        res.send({ card: { ...card, uuid } });
      });
  });

  return cardRouter;
};

export default createCardRouter;
