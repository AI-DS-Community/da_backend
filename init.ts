import { Database } from "sqlite3";

const db = new Database("db.scards");

db.exec(
  `CREATE TABLE IF NOT EXISTS teams (
    reg_number INTEGER PRIMARY KEY ASC, 
    team_name TEXT, 
    event_name INTEGER, 
    all_passes TEXT,
    contact_number TEXT, 
    email_id TEXT, 
    team_members TEXT, 
    institution_name TEXT, 
    degree_and_branch TEXT,
    agree_to_terms TEXT,
    reference_id TEXT,
    paid INTEGER DEFAULT 0
    )`,
);

db.exec(
  `CREATE TABLE IF NOT EXISTS all_pass (
    reg_number INTEGER PRIMARY KEY ASC, 
    name TEXT, 
    contact_number TEXT, 
    email_id TEXT, 
    institution_name TEXT, 
    degree_and_branch TEXT,
    agree_to_terms TEXT,
    reference_id TEXT,
    paid INTEGER DEFAULT 0
    )`,
);
