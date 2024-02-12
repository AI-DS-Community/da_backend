import "https://deno.land/std@0.215.0/dotenv/load.ts";
import { Application, Router } from "oak";
import { oakCors } from "oakCors";

import { Database } from "sqlite3";

import { logger } from "./log.ts";

import {
  Client,
  Embed,
  GatewayIntents,
  MessageAttachment,
} from "https://deno.land/x/harmony@v2.8.0/mod.ts";

const SCARDS_EPOCH = 1667759400000;
const HOOK_REG = Deno.env.get("REGISTRATIONS");
const HOOK_PASS = Deno.env.get("PASSES");

import { stringify } from "https://deno.land/std@0.176.0/encoding/csv.ts";

//console.log(new Array(9).fill(0).map((x) => create(SCARDS_EPOCH)));

const columns = {
  teams: [
    "reg_number",
    "team_name",
    "event_name",
    "all_passes",
    "contact_number",
    "email_id",
    "team_members",
    "institution_name",
    "degree_and_branch",
    "agree_to_terms",
    "reference_id",
    "paid",
    "transaction_id",
  ],
  passes: [
    "reg_number",
    "name",
    "contact_number",
    "email_id",
    "institution_name",
    "degree_and_branch",
    "agree_to_terms",
    "reference_id",
    "paid",
    "transaction_id",
  ],
};

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

const getTeamLength = db.prepare(`SELECT count(reference_id) FROM teams`);

const getPassLength = db.prepare(`SELECT count(reference_id) FROM all_pass`);

const setPaidPass = db.prepare(
  `UPDATE all_pass SET paid = ? WHERE reference_id = ?`
);
const setPaidReg = db.prepare(
  `UPDATE teams SET paid = ? WHERE reference_id = ?`
);

const setIdPass = db.prepare(
  `UPDATE all_pass SET transaction_id = ? WHERE reference_id = ?`
);
const setIdReg = db.prepare(
  `UPDATE teams SET transaction_id = ? WHERE reference_id = ?`
);


const allPasses = db.prepare(`SELECT * FROM all_pass`);
const allTeams = db.prepare(`SELECT * FROM teams`);

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
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`
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
    FROM teams WHERE reference_id = ?`
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
     FROM all_pass WHERE reference_id = ?`
);

const verifyPass = db.prepare(`SELECT name FROM all_pass WHERE reference_id=?`);
const verifyPaidPass = db.prepare(`SELECT name FROM all_pass WHERE reference_id=? AND transaction_id IS NOT NULL`);

const getAllRegistrations = db.prepare(
  `SELECT * FROM teams WHERE event_name=?`
);

const getPassUsage = db.prepare(
  `SELECT events FROM all_pass WHERE reference_id = ?`
);

const addPassUsage = db.prepare(
  `UPDATE all_pass SET events = events + 1 WHERE reference_id = ?`
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
      `Attempt at ${Date.now()} using ${JSON.stringify(data)} for REG`
    );

    if (data.all_passes) {
      const passes = data.all_passes.split(";").map((x) => x);
      const members = data.team_members
        .split(";")
        .map((x) => x)
        .map((x) => x.toLowerCase());

      if (passes.length > members.length) {
        ctx.response.status = 200;
        ctx.response.body = {
          message: `Registration Unsuccessful! Passes do not match the team members listed.`,
        };
        return;
      }
      if(passes.filter((x, i) => passes.indexOf(x) !== i).length) {
        ctx.response.status = 200;
        ctx.response.body = {
          message: `Registration Unsuccessful! Duplicate passes used.`,
        };
        return;
      }

      for (const pass of passes) {
        const name = verifyPaidPass.get(/(?:p-)?(\d+)/i.exec(pass)?.[0]);
        if (!name) {
          ctx.response.status = 200;
          ctx.response.body = {
            message: `Registration Unsuccessful! Pass ${pass} does not exist. Or not paid.`,
          };
          return;
        } else if (!members.includes((name.name as string).toLowerCase())) {
          ctx.response.status = 200;
          ctx.response.body = {
            message: `Registration Unsuccessful! Pass ${pass} does not belong to any of the listed members.`,
          };
          return;
        }
      }
      for (const row of getAllRegistrations.all(data.event_name)) {
        console.log(row)
        const usedPasses = ((row.all_passes || "") as string).split(";");
        if (usedPasses.some((x) => passes.includes(x))) {
          ctx.response.status = 200;
          ctx.response.body = {
            message: `Registration Unsuccessful! One of the passes has already been used for registering in this event.`,
          };
          return;
        }
      }
      for (const pass of passes) {
        const count = getPassUsage.get(/(?:p-)?(\d+)/i.exec(pass)?.[0]);
        if (!count) {
          ctx.response.status = 200;
          ctx.response.body = {
            message: `Registration Unsuccessful! Pass ${pass} does not exist.`,
          };
          return;
        } else if ((count.count as number) >= 3) {
          ctx.response.status = 200;
          ctx.response.body = {
            message: `Registration Unsuccessful! Pass ${pass} has already been used three times.`,
          };
          return;
        }
      }
    }
    const last: number =
      (getTeamLength.get()?.["count(reference_id)"] as number) || 0;
    const ref_id = `${10000 + last}`;

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
      ref_id
    );
    if (data.all_passes) {
      const passes = data.all_passes.split(";").map((x) => x)
      passes.forEach(pass => addPassUsage.run(pass))
    }

    if (data) {
      const embed = new Embed().setColor("#c39232");
      let res = `\n**REF**: ${ref_id}`;
      res += `\n**TEAM**: ${data.team_name}`;
      res += `\n**PASSES**: ${data.all_passes}`;
      res += `\n**MEMBERS**: ${data.team_members}`;
      res += `\n**EVENT**: ${data.event_name}`;
      res += `\n**CONTACT**: ${data.contact_number}`;
      res += `\n**EMAIL**: ${data.email_id}`;
      res += `\n**INSTITUTION**: ${data.institution_name}`;
      res += `\n**DEGREE**: ${data.degree_and_branch}`;
      res += `\n**AGREED TO TERMS**: ${data.agree_to_terms}`;
      embed.setDescription(res);
      const embedbody = { embeds: [embed.toJSON()] };
      fetch(String(HOOK_REG), {
        method: "post",
        body: JSON.stringify(embedbody),
        headers: { "Content-Type": "application/json" },
      });
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
      `Attempt at ${Date.now()} using ${JSON.stringify(data)} for PASS`
    );
    const last: number =
      (getPassLength.get()?.["count(reference_id)"] as number) || 0;
    const ref_id = `${90000 + last}`;

    addPass.run(
      data.name,
      data.contact_number,
      data.email_id,
      data.institution_name,
      data.degree_and_branch,
      data.agree_to_terms,
      ref_id
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

router.post("/all_pass_id", async (ctx, _next) => {
  try {
    const body = ctx.request.body({ type: "json" });

    const data: Record<string, string> = await body.value;

    logger.info(
      `Attempt at ${Date.now()} using ${JSON.stringify(data)} for PASS ID`
    );
    const ref_id = data.ref_id;

    setIdPass.run(data.transaction_id, ref_id)
    const pass = getPassDetails.get(ref_id)

    if (pass) {
      const embed = new Embed().setColor("#c39232").setTitle("ALL PASS");
      let res = `\n**REF**: ${ref_id}`;
      res += `\n**NAME**: ${pass.name}`;
      res += `\n**CONTACT**: ${pass.contact_number}`;
      res += `\n**EMAIL**: ${pass.email_id}`;
      res += `\n**INSTITUTION**: ${pass.institution_name}`;
      res += `\n**DEGREE**: ${pass.degree_and_branch}`;
      res += `\n**AGREED TO TERMS**: ${pass.agree_to_terms}`;
      res += `\n**TRANSACTION_ID**: ${data.transaction_id}`
      embed.setDescription(res);
      const embedbody = { embeds: [embed.toJSON()] };
      fetch(String(HOOK_PASS), {
        method: "post",
        body: JSON.stringify(embedbody),
        headers: { "Content-Type": "application/json" },
      });

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

router.post("/all_registration_id", async (ctx, _next) => {
  try {
    const body = ctx.request.body({ type: "json" });

    const data: Record<string, string> = await body.value;

    logger.info(
      `Attempt at ${Date.now()} using ${JSON.stringify(data)} for PASS ID`
    );
    const ref_id = data.ref_id;

    setIdReg.run(data.transaction_id, ref_id)
    const pass = getTeamDetails.get(ref_id)

    if (pass) {
      const embed = new Embed().setColor("#c39232").setTitle("ALL PASS");
      let res = `\n**REF**: ${ref_id}`;
      res += `\n**TEAM**: ${pass.team_name}`;
      res += `\n**PASSES**: ${pass.all_passes}`;
      res += `\n**MEMBERS**: ${pass.team_members}`;
      res += `\n**EVENT**: ${pass.event_name}`;
      res += `\n**CONTACT**: ${pass.contact_number}`;
      res += `\n**EMAIL**: ${pass.email_id}`;
      res += `\n**INSTITUTION**: ${pass.institution_name}`;
      res += `\n**DEGREE**: ${pass.degree_and_branch}`;
      res += `\n**AGREED TO TERMS**: ${pass.agree_to_terms}`;
      res += `\n**TRANSACTION_ID**: ${data.transaction_id}`

      embed.setDescription(res);
      const embedbody = { embeds: [embed.toJSON()] };
      fetch(String(HOOK_REG), {
        method: "post",
        body: JSON.stringify(embedbody),
        headers: { "Content-Type": "application/json" },
      });

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

const SET_COMMAND = /^set\s(P|R)-(\d+)\s(paid|unpaid)/i;

client.on("messageCreate", (message) => {
  if (message.channelID !== "1069859960428707954") return;
  if (GET_COMMAND.exec(message.content)) {
    const args = GET_COMMAND.exec(message.content);
    if (args) {
      const data =
        args[1].toLowerCase() === "p"
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
  } else if (SET_COMMAND.exec(message.content)) {
    const args = SET_COMMAND.exec(message.content);
    if (args) {
      const data =
        args[1].toLowerCase() === "p"
          ? setPaidPass.run(args[3], args[2].toLowerCase() === "paid" ? 1 : 0)
          : setPaidReg.run(args[3], args[2].toLowerCase() === "paid" ? 1 : 0);
      message.channel.send("Done");
    }
  } else if (message.content.toLowerCase() === "dump all") {
    const passes = allPasses.all();
    const teams = allTeams.all();

    const passString = stringify(passes, { columns: columns.passes });
    const teamString = stringify(teams, { columns: columns.teams });

    message.channel.send("Ok", {
      files: [
        new MessageAttachment(
          "all_pass.csv",
          new TextEncoder().encode(passString)
        ),
        new MessageAttachment(
          "teams.csv",
          new TextEncoder().encode(teamString)
        ),
      ],
    });
    const dat = teams.map((x) => x.event_name);
    const files = dat
      .filter((x, i) => dat.indexOf(x) === i)
      .map(
        (x) =>
          new MessageAttachment(
            `${x}.csv`,
            new TextEncoder().encode(
              stringify(
                teams.filter((y) => y.event_name === x),
                {
                  columns: columns.teams,
                }
              )
            )
          )
      );

    let pointer = 0;
    while (pointer < dat.length - 10) {
      message.channel.send({
        files: files.slice(pointer, pointer + 10),
      });
      pointer += 10;
    }
  }
});

client.connect();
