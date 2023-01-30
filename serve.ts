import { Application, Router } from "oak";
import { oakCors } from "oakCors";

import { Database } from "sqlite3";

import { logger } from "./log.ts";

import { create } from "https://deno.land/x/id_gen@v1.1.0/mod.ts";

const SCARDS_EPOCH = 1667759400000;

//console.log(new Array(9).fill(0).map((x) => create(SCARDS_EPOCH)));

const db = new Database("db.scards");

const addTeam = db.prepare(
  `INSERT INTO teams (
    team_name, 
    team_members, 
    all_passes,
    event_name, 
    contact_number, 
    email_id, 
    institution_name, 
    degree_and_branch,
    agree_to_terms,
    reference_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);

const addPass = db.prepare(
  `INSERT INTO all_pass (
    name, 
    contact_number, 
    email_id, 
    institution_name, 
    degree_and_branch,
    agree_to_terms,
    reference_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
);

const verifyPass = db.prepare(`SELECT name FROM all_pass WHERE reference_id=?`);

const getAllRegistrations = db.prepare(
  `SELECT * FROM teams WHERE event_name=?`,
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

    const data: Record<string, string> = await body.value;

    logger.info(
      `Attempt at ${Date.now()} using ${JSON.stringify(data)} for REG`,
    );

    if (data.all_passes) {
      const passes = data.all_passes.split(";");
      const members = data.team_members.split(";");

      if (passes.length > members.length) {
        ctx.response.status = 200;
        ctx.response.body = {
          message:
            `Registration Unsuccessful! Passes do not match the team members listed.`,
        };
        return;
      }

      for (const pass of passes) {
        const name = verifyPass.get(pass);
        if (!name) {
          ctx.response.status = 200;
          ctx.response.body = {
            message: `Registration Unsuccessful! Pass ${pass} does not exist.`,
          };
          return;
        } else if (!members.includes(name.name as string)) {
          ctx.response.status = 200;
          ctx.response.body = {
            message:
              `Registration Unsuccessful! Pass ${pass} does not belong to any of the listed members.`,
          };
          return;
        }
      }

      for (const row of getAllRegistrations.all(data.event_name)) {
        const usedPasses = ((row.all_passes || "") as string).split(";");
        if (usedPasses.some((x) => passes.includes(x))) {
          ctx.response.status = 200;
          ctx.response.body = {
            message:
              `Registration Unsuccessful! One of the passes has already been used for registering in this event.`,
          };
          return;
        }
      }
    }

    const ref_id = create(SCARDS_EPOCH);

    addTeam.run(
      data.team_name,
      data.team_members,
      data.all_passes,
      data.event_name,
      data.contact_number,
      data.email_id,
      data.institution_name,
      data.degree_and_branch,
      data.agree_to_terms,
      ref_id,
    );

    if (data) {
      ctx.response.status = 200;
      ctx.response.body = {
        message: "Reservation Success!",
        unique_code: `${ref_id}`,
      };
    } else throw `Invalid body at ${Date.now()}`;
  } catch (e) {
    console.error(e);
    logger.error(`${Date.now()} => ${e.toString()}`);
    ctx.response.status = 500;
    ctx.response.body = {
      message: "An error occured.",
    };
  }
});

router.post("/all_pass", async (ctx, _next) => {
  try {
    const body = ctx.request.body({ type: "json" });

    const data: Record<string, string> = await body.value;

    logger.info(
      `Attempt at ${Date.now()} using ${JSON.stringify(data)} for PASS`,
    );
    const ref_id = create(SCARDS_EPOCH);

    addPass.run(
      data.name,
      data.contact_number,
      data.email_id,
      data.institution_name,
      data.degree_and_branch,
      data.agree_to_terms,
      ref_id,
    );

    if (data) {
      ctx.response.status = 200;
      ctx.response.body = {
        message: "Reservation Success!",
        unique_code: `${ref_id}`,
      };
    } else throw `Invalid body at ${Date.now()}`;
  } catch (e) {
    console.error(e);
    logger.error(`${Date.now()} => ${e.toString()}`);
    ctx.response.status = 500;
    ctx.response.body = {
      message: "An error occured.",
    };
  }
});

app.use(oakCors());
app.use(router.routes());
app.use(router.allowedMethods());

app.listen({ port: 6123 });
