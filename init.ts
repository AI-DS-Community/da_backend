import { Database } from "sqlite3";

const db = new Database("db.scards");

db.exec(
  `CREATE TABLE teams (
    reg_number INTEGER PRIMARY KEY ASC, 
    team_name TEXT, 
    event_name INTEGER, 
    contact_number TEXT, 
    email_id TEXT, 
    team_members TEXT, 
    institution_name TEXT, 
    degree_and_branch TEXT,
    reference_id TEXT
    )`,
);
