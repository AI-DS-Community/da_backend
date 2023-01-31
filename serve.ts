import { Application, Router } from "oak";
import { oakCors } from "oakCors";

import { Database } from "sqlite3";

import { logger } from "./log.ts";

import {
  Client,
  Embed,
  GatewayIntents,
} from "https://deno.land/x/harmony@v2.8.0/mod.ts";

const SCARDS_EPOCH = 1667759400000;

//console.log(new Array(9).fill(0).map((x) => create(SCARDS_EPOCH)));

const AddZero = (s: string | number, n: number) =>
  s.toString().padStart(n, "0");
const counter = new Uint8Array(1);
counter[0] = 0;
function formatCount(): string {
  if (Atomics.load(counter, 0) === 999) Atomics.store(counter, 0, 0);
  Atomics.add(counter, 0, 1);
  return AddZero(Atomics.load(counter, 0), 3);
}

const db = new Database("db.scards");

const getTeamLength = db.prepare(
  `SELECT count(reference_id) FROM teams`,
);

const getPassLength = db.prepare(
  `SELECT count(reference_id) FROM all_pass`,
);

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

const getTeamDetails = db.prepare(
  `SELECT 
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
    FROM teams WHERE reference_id = ?`,
);

const getPassDetails = db.prepare(
  `SELECT 
    name, 
    contact_number, 
    email_id, 
    institution_name, 
    degree_and_branch,
    agree_to_terms,
    reference_id
     FROM all_pass WHERE reference_id = ?`,
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

    const last: number = getTeamLength.get()?.count as number || 0;
    const ref_id = `${(10000 + last)}${formatCount()}`;

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
    const last: number = getAllRegistrations.get()?.count as number || 0;
    const ref_id = `${(10000 + last)}${formatCount()}`;

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

const DISCORD_TOKEN = Deno.env.get("LALA_TOKEN");

const client = new Client({
  token: DISCORD_TOKEN,
  disableEnvToken: true,
  intents: [
    GatewayIntents.GUILDS,
    GatewayIntents.MESSAGE_CONTENT,
    GatewayIntents.GUILD_MESSAGES,
  ],
});

const GET_COMMAND = /^get\s(P|R)-(\d+)/i;

client.on("messageCreate", (message) => {
  if (message.channelID !== "1069859960428707954") return;
  if (GET_COMMAND.exec(message.content)) {
    const args = GET_COMMAND.exec(message.content);
    if (args) {
      const data = args[1].toLowerCase() === "p"
        ? getPassDetails.all(args[2])
        : getTeamDetails.all(args[2]);

      for (const row of data) {
        const e = new Embed().setColor("#c39232");
        let res = `\nREF: ${args[2]}`;
        if (args[1].toLowerCase() === "p") {
          res += `\nNAME: ${row.name}`;
        } else {
          res += `\nTEAM: ${row.team_name}`;
          res += `\nPASSES: ${row.all_passes}`;
          res += `\nEVENT: ${row.event_name}`;
        }
        res += `\nCONTACT: ${row.contact_number}`;
        res += `\nEMAIL: ${row.email_id}`;
        res += `\nINSTITUTION: ${row.institution_name}`;
        res += `\nDEGREE: ${row.degree_and_branch}`;
        res += `\nAGREED TO TERMS: ${row.agree_to_terms}`;
        e.setDescription(res);
        message.channel.send({ embeds: [e] });
      }
    }
  }
});

client.connect();
