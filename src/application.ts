import { ApplicationContext } from "./types";
import { sendMessage, sendPhoto, cleanString } from "./bot";
import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import morgan from "morgan";
import { Bot } from "grammy";
import { CronJob } from "cron";
import Airtable from "airtable";

export async function startApplication() {
  let context: ApplicationContext = {};

  // start up bot
  const botToken = process.env.BOT_TOKEN;
  if (botToken !== undefined) {
    context = {
      bot: new Bot(botToken),
    };
    context.bot?.start();
  }

  async function postNewCards() {
    const base = new Airtable({
      apiKey: process.env.AIRTABLE_API_KEY,
    }).base("appJcTn3eQUXKQEKT");

    const postedRecordIds: string[] = [];

    base("Image link")
      .select({
        fields: [
          "experienceName",
          "pubKeyHex",
          "imageUrl",
          "allocated",
          "posted",
          "cardPhotoUrl",
          "cardHolder",
        ],
      })
      .eachPage(
        async function page(records, fetchNextPage) {
          for (const record of records) {
            console.log(record.get("experienceName"), record.get("allocated"), record.get("posted"));
            
            if (record.get("allocated") && !record.get("posted")) {
              const experienceName = record.get("experienceName");
              const imageUrl = record.get("imageUrl");
              if (experienceName && imageUrl) {
                let message = `The stamp for <b>${cleanString(
                  experienceName.toString()
                )}</b> is available to claim!`;
                await sendPhoto(imageUrl.toString(), message, context.bot);
              }

              const cardPhotoUrl = record.get("cardPhotoUrl");
              const cardHolder = record.get("cardHolder");
              if (experienceName && cardHolder) {
                const message = `<b>${cleanString(
                  cardHolder.toString()
                )}</b> is the owner of the NFC card for ${cleanString(
                  experienceName.toString()
                )}.`;

                if (cardPhotoUrl) {
                  await sendPhoto(
                    cardPhotoUrl.toString(),
                    message,
                    context.bot
                  );
                } else {
                  await sendMessage(message, context.bot);
                }
              }

              postedRecordIds.push(record.id);
            }
          }
          fetchNextPage();
        },
        async function done(err) {
          if (err) {
            console.error(err);
            return;
          }

          await base("Image link").update(
            postedRecordIds.map((id) => ({ id, fields: { posted: true } }))
          );
        }
      );
  }

  // start up cron job to read from Airtable
  const cronJob = new CronJob(
    "0,10,20,30,40,50 * * * *", // every 10 minutes, check if any cards have been allocated
    async () => await postNewCards(),
  );
  cronJob.start();

  // start up web server
  const port = process.env.PORT;
  const app = express();

  app.use(morgan("tiny"));
  app.use(express.json());
  app.use(cors());

  app.post(
    "/bot-post",
    async (req: Request, res: Response, next: NextFunction) => {
      const request = req.body as BotPostRequest;

      try {
        sendMessage(request.message, context.bot);
      } catch (e) {
        console.error(e);
        next(e);
      }

      res.status(200);
    }
  );

  app.use(
    cors({
      origin: "*",
      methods: ["GET", "POST", "PUT", "DELETE"],
    })
  );

  app.use(
    (
      err: Error,
      req: express.Request,
      res: express.Response,
      _next: NextFunction
    ) => {
      console.error(`[ERROR] ${req.method} ${req.url}`);
      console.error(err.stack);
      res.status(500).send(err.message);
    }
  );

  app
    .listen(port, () => {
      console.log(`[INIT] HTTP server listening on port ${port}`);
    })
    .on("error", (e: Error) => {
      console.error(e);
    });
}

export type BotPostRequest = {
  message: string;
};
