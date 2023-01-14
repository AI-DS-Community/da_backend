import { handlers, Logger } from "https://deno.land/std@0.172.0/log/mod.ts";

const file_reg = new handlers.FileHandler("INFO", {
  filename: "./reg_log",
  formatter: "{levelName} {msg}",
});

const file_err = new handlers.FileHandler("ERROR", {
  filename: "./err_log",
  formatter: "{levelName} {msg}",
});

file_reg.setup();
file_err.setup();

const logger = new Logger("registration", "INFO", {
  handlers: [file_err, file_reg],
});

export { logger };
