import { readFileSync } from "node:fs";
import { join } from "node:path";

interface PackageJson {
  version?: string;
}

export function getTakomiVersion() {
  try {
    const packagePath = join(process.cwd(), "..", "package.json");
    const packageJson = JSON.parse(
      readFileSync(packagePath, "utf8"),
    ) as PackageJson;

    return packageJson.version ?? "local";
  } catch {
    return "local";
  }
}
