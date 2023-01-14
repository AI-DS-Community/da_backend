import { Application, Router } from "oak";
import { oakCors } from "oakCors";

import { Database } from "sqlite3";

import { logger } from "./log.ts";

const db = new Database("db.scards");



const addUser = db.prepare(
  `INSERT INTO teams (
    team_name, 
    team_members, 
    event_name, 
    contact_number, 
    email_id, 
    institution_name, 
    degree_and_branch,
    reference_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
);

const app = new Application();

const router = new Router();

router.get("/", (ctx, _next) => {
  ctx.response.status = 200;
  ctx.response.body = "Hello, Warudo!";
});

router.post("/confirm_reg", async (ctx, _next) => {
  try {
    const body = ctx.request.body({ type: "json" });

    const data = await body.value;

    if (data) {
      ctx.response.status = 200;
      ctx.response.body = {
        message: "Registration Success!",
        unique_code: `CODE`,
      };
    } else throw `Invalid body at ${Date.now()}`;
  } catch (e) {
    logger.error(`${Date.now()} => ${e.toString()}`);
  }
});

app.use(oakCors());
app.use(router.routes());
app.use(router.allowedMethods());

app.listen({ port: 8080 });

