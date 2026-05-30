#!/usr/bin/env node
import { execSync } from "node:child_process";

const port = process.argv[2] || "3000";

function run(command) {
  try {
    return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return "";
  }
}

function killWindowsPids(pids) {
  for (const pid of pids) {
    // Ignore failures for already-exited processes.
    run(`taskkill /PID ${pid} /F`);
  }
}

function killUnixPids(pids) {
  for (const pid of pids) {
    run(`kill -9 ${pid}`);
  }
}

function uniquePids(values) {
  return [...new Set(values.filter((value) => /^\d+$/.test(value) && value !== "0"))];
}

if (process.platform === "win32") {
  const output = run(`netstat -ano | findstr :${port}`);
  const pids = uniquePids(
    output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => line.includes(`:${port}`))
      .map((line) => line.split(/\s+/).at(-1))
  );

  if (pids.length) {
    killWindowsPids(pids);
    console.log(`Freed port ${port} by stopping PID(s): ${pids.join(", ")}`);
  } else {
    console.log(`Port ${port} is already free.`);
  }
} else {
  const output = run(`lsof -ti tcp:${port}`);
  const pids = uniquePids(output.split(/\r?\n/).map((line) => line.trim()));

  if (pids.length) {
    killUnixPids(pids);
    console.log(`Freed port ${port} by stopping PID(s): ${pids.join(", ")}`);
  } else {
    console.log(`Port ${port} is already free.`);
  }
}
