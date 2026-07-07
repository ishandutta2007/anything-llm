import * as fs from 'fs';
import * as path from 'path';
import { spawnSync, spawn } from 'child_process';
import {
  PLATFORM, GUEST_ARCH, CPUS, RAM, SERVICE_DIR,
  resolveQemuBinary, resolveQemuImgBinary, resolveEfiCode,
} from './config.js';

// ── Process helpers ──────────────────────────────────────────────────────────

export function isRunning(pidFile: string): boolean {
  if (!fs.existsSync(pidFile)) return false;
  try {
    const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim(), 10);
    if (isNaN(pid)) return false;
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function readPid(pidFile: string): number | null {
  if (!fs.existsSync(pidFile)) return null;
  const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim(), 10);
  return isNaN(pid) ? null : pid;
}

export function killPid(pidFile: string): void {
  const pid = readPid(pidFile);
  if (pid !== null) {
    try { process.kill(pid, 'SIGKILL'); } catch { /* already gone */ }
  }
  fs.rmSync(pidFile, { force: true });
}

// ── QEMU args builder ────────────────────────────────────────────────────────

interface QemuArgsOptions {
  disk: string;
  efi: string;
  sshPort: number;
  pidFile: string;
  monitorSock: string;
  appPort?: number;
  dev?: boolean;
  gui?: boolean;
  vncDisplay?: number;
}

function buildMachineArgs(): string[] {
  // Machine type depends on the guest ISA, not the host OS.
  // 'virt' is the ARM64 platform board; 'q35' is the x86_64 platform board.
  const machine = GUEST_ARCH === 'aarch64' ? 'virt,highmem=on' : 'q35';

  if (PLATFORM === 'win32') {
    return ['-machine', machine, '-accel', 'whpx', '-cpu', 'host'];
  }
  if (PLATFORM === 'linux') {
    return ['-machine', machine, '-accel', 'kvm', '-cpu', 'host'];
  }
  // macOS (darwin): HVF for both arm64 (virt) and x64 (q35)
  return ['-machine', machine, '-accel', 'hvf', '-cpu', 'host'];
}

export function buildQemuArgs(opts: QemuArgsOptions): string[] {
  const { disk, efi, sshPort, pidFile, monitorSock, appPort, dev, vncDisplay = 1 } = opts;
  const efiCode = resolveEfiCode();

  // Ensure per-VM efi-vars.fd exists (copy from firmware if missing)
  if (!fs.existsSync(efi)) {
    fs.copyFileSync(efiCode, efi);
  }

  let netdev = `user,id=net0,hostfwd=tcp::${sshPort}-:22`;
  if (appPort !== undefined) {
    netdev += `,hostfwd=tcp::${appPort}-:8080`;
  }

  const args: string[] = [
    ...buildMachineArgs(),
    '-smp', String(CPUS),
    '-m', RAM,
    '-drive', `if=pflash,format=raw,readonly=on,file=${efiCode}`,
    '-drive', `if=pflash,format=raw,file=${efi}`,
    '-drive', `if=virtio,format=qcow2,discard=unmap,detect-zeroes=unmap,file=${disk}`,
    '-device', 'virtio-net-pci,netdev=net0',
    '-netdev', netdev,
    '-device', 'virtio-gpu-pci',
    '-device', 'virtio-rng-pci',
    '-device', 'qemu-xhci',
    '-device', 'usb-kbd',
    '-device', 'usb-tablet',
    '-pidfile', pidFile,
    '-monitor', `unix:${monitorSock},server,nowait`,
  ];

  if (dev) {
    // 9p virtio host share (dev mode): supported on macOS and Windows ARM64
    // Windows x64 uses SCP sync instead (handled separately)
    if (!(PLATFORM === 'win32' && GUEST_ARCH === 'x86_64')) {
      args.push(
        '-fsdev', `local,id=svc,path=${SERVICE_DIR},security_model=mapped-xattr`,
        '-device', `virtio-9p-pci,fsdev=svc,mount_tag=open-computer_service`,
      );
    }
  }

  return args;
}

// ── Start/stop helpers ───────────────────────────────────────────────────────

interface StartVmOptions extends QemuArgsOptions {
  gui?: boolean;
  daemonize?: boolean;
}

export function startVm(opts: StartVmOptions): boolean {
  const { pidFile, gui = false, daemonize = true } = opts;

  if (isRunning(pidFile)) {
    const pid = readPid(pidFile);
    console.log(`Already running (pid ${pid}).`);
    return true;
  }

  const binary = resolveQemuBinary();
  const args = buildQemuArgs(opts);

  if (gui) {
    // GUI mode: show QEMU window, run in background
    const displayArgs = PLATFORM === 'darwin' ? ['-display', 'cocoa'] : ['-display', 'gtk'];
    const child = spawn(binary, [...args, ...displayArgs], {
      stdio: 'ignore',
      detached: true,
    });
    child.unref();
  } else if (daemonize && PLATFORM !== 'win32') {
    // macOS/Linux: use QEMU's built-in -daemonize
    const result = spawnSync(binary, [...args, '-display', 'none', '-daemonize'], {
      stdio: 'inherit',
    });
    if (result.status !== 0) {
      console.error('Failed to start QEMU.');
      return false;
    }
  } else {
    // Windows or non-daemonize: detach via Node
    const child = spawn(binary, [...args, '-display', 'none'], {
      stdio: 'ignore',
      detached: true,
    });
    child.unref();
    // Give the process a moment to write the pidfile
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
  }

  // Brief pause to let pidfile be written
  const started = Date.now();
  while (Date.now() - started < 3000) {
    if (isRunning(pidFile)) {
      const pid = readPid(pidFile);
      console.log(`Started (pid ${pid}).`);
      return true;
    }
    // Busy-wait is acceptable here for a 3-second window
  }

  console.error('Failed to start (pidfile not found after 3s).');
  return false;
}

// ── qemu-img wrappers ────────────────────────────────────────────────────────

export function qemuImgCreate(file: string, backingFile: string, size: string): boolean {
  const result = spawnSync(resolveQemuImgBinary(), [
    'create', '-f', 'qcow2', '-b', backingFile, '-F', 'qcow2', file,
  ], { stdio: 'pipe' });
  return result.status === 0;
}

export function qemuImgConvert(src: string, dst: string, backingFile?: string): boolean {
  const args = [
    'convert', '-O', 'qcow2', '-c',
    ...(backingFile ? ['-B', backingFile, '-F', 'qcow2'] : []),
    src, dst,
  ];
  const result = spawnSync(resolveQemuImgBinary(), args, { stdio: 'inherit' });
  return result.status === 0;
}

export function fileSize(filePath: string): number {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

// ── Graceful shutdown ────────────────────────────────────────────────────────

import { sshRun } from './ssh.js';
import { VM_USER } from './config.js';

export function waitForShutdown(
  pidFile: string,
  monitorSock: string,
  sshPort?: number,
): void {
  if (sshPort !== undefined) {
    process.stdout.write('Shutting down via SSH...');
    sshRun(sshPort, VM_USER, 'sudo shutdown -h now', { silent: true });
  } else {
    // Fallback: ACPI power-down via QEMU monitor (Unix socket)
    process.stdout.write('Sending ACPI shutdown...');
    try {
      // Use nc/socat to send to the monitor socket
      spawnSync('sh', ['-c', `echo system_powerdown | socat - UNIX-CONNECT:${monitorSock}`], {
        stdio: 'pipe',
      });
    } catch { /* socat may not be available */ }
  }

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (!isRunning(pidFile)) {
      process.stdout.write(' stopped.\n');
      fs.rmSync(pidFile, { force: true });
      fs.rmSync(monitorSock, { force: true });
      return;
    }
    process.stdout.write('.');
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
  }

  // Force kill after timeout
  process.stdout.write(' force-killing.\n');
  killPid(pidFile);
  fs.rmSync(monitorSock, { force: true });
}
