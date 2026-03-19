import { execSync } from "child_process";
execSync("./node_modules/.bin/tsc --noEmit", { stdio: "inherit" });
