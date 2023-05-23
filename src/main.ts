import * as dotenv from "dotenv";
import * as path from "path";
import { IS_DEPLOYED } from "./deployment";
import { startApplication } from "./application";

const dotEnvPath = IS_DEPLOYED
  ? `/etc/secrets/.env`
  : path.join(process.cwd(), ".env");

console.log(`[INIT] Loading environment variables from: ${dotEnvPath} `);
dotenv.config({ path: dotEnvPath });

console.log("[INIT] Starting application");

startApplication();
