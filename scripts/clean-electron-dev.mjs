#!/usr/bin/env node
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const workspace = process.cwd().replace(/\\/g, '\\\\');
const devRoot = path.join(os.tmpdir(), 'proviso-electron-dev');

function run(command) {
  try {
    return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    return error.stdout || '';
  }
}

function cleanupDevRoot() {
  try {
    fs.rmSync(devRoot, { recursive: true, force: true });
    console.log(`Removed dev temp root: ${devRoot}`);
  } catch (error) {
    console.warn(`Could not remove dev temp root: ${error.message}`);
  }
}

if (process.platform === 'win32') {
  const ps = [
    "$ErrorActionPreference = 'SilentlyContinue'",
    `$workspace = '${workspace}'`,
    "Get-CimInstance Win32_Process -Filter \"name = 'electron.exe' OR name = 'node.exe'\" |",
    "Where-Object { $_.CommandLine -and ($_.CommandLine -like ('*' + $workspace + '*') -or $_.CommandLine -like '*vite*3000*' -or $_.CommandLine -like '*wait-on*127.0.0.1:3000*') } |",
    "ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; Write-Output ('stopped ' + $_.Name + ' ' + $_.ProcessId) }",
  ].join('; ');

  const output = run(`powershell -NoProfile -Command \"${ps}\"`);
  if (output.trim()) {
    process.stdout.write(output);
  } else {
    console.log('No stale Electron/Node processes found for this workspace.');
  }
} else {
  const output = run(`pkill -f \"${process.cwd().replace(/\"/g, '\\\"')}\" || true`);
  if (output.trim()) {
    process.stdout.write(output);
  }
}

cleanupDevRoot();
