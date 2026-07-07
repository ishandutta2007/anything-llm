import * as path from 'path';
import * as fs from 'fs';

// Resolve the project root: cli/ lives one level inside the repo root
export const OPEN_COMPUTER_DIR = path.resolve(__dirname, '..', '..');

// ── Platform detection ──────────────────────────────────────────────────────

export type Platform = 'darwin' | 'win32' | 'linux';
export type Arch = 'arm64' | 'x64';

export const PLATFORM = process.platform as Platform;
export const ARCH = process.arch as Arch;

// On macOS/Linux arm64 the guest is aarch64 (HVF/KVM + ARM64 Debian).
// On macOS/Linux x64  the guest is x86_64  (HVF/KVM + amd64 Debian).
// On Windows x64      the guest is x86_64  (WHPX + amd64 Debian).
// On Windows arm64    the guest is aarch64 (WHPX + ARM64 Debian).
export const GUEST_ARCH: 'aarch64' | 'x86_64' = ARCH === 'x64' ? 'x86_64' : 'aarch64';

export const QEMU_BINARY =
  GUEST_ARCH === 'aarch64' ? 'qemu-system-aarch64' : 'qemu-system-x86_64';

function defaultQemuDir(): string {
  if (PLATFORM === 'darwin') {
    const darwinVariant = ARCH === 'x64' ? 'darwin-x64' : 'darwin-arm64';
    return path.join(OPEN_COMPUTER_DIR, 'master', 'qemu', darwinVariant);
  }
  if (PLATFORM === 'win32' && ARCH === 'x64') return path.join(OPEN_COMPUTER_DIR, 'master', 'qemu', 'win-x64');
  if (PLATFORM === 'win32' && ARCH === 'arm64') return path.join(OPEN_COMPUTER_DIR, 'master', 'qemu', 'win-arm64');
  // Linux: assume system QEMU
  return '';
}

export const QEMU_DIST = process.env.OPEN_COMPUTER_QEMU_DIR ?? defaultQemuDir();

// Full path to the QEMU binary (with .exe on Windows)
export function resolveQemuBinary(): string {
  const binaryName = PLATFORM === 'win32' ? `${QEMU_BINARY}.exe` : QEMU_BINARY;
  if (QEMU_DIST) {
    const bundled = path.join(QEMU_DIST, 'bin', binaryName);
    if (fs.existsSync(bundled)) return bundled;
    // Windows QEMU may sit directly in the dist folder
    const direct = path.join(QEMU_DIST, binaryName);
    if (fs.existsSync(direct)) return direct;
  }
  // Fall back to system PATH
  return binaryName;
}

// EFI firmware — filename depends on the guest architecture
const EFI_FIRMWARE_FILE =
  GUEST_ARCH === 'x86_64' ? 'edk2-x86_64-code.fd' : 'edk2-aarch64-code.fd';

export function resolveEfiCode(): string {
  if (QEMU_DIST) {
    const bundled = path.join(QEMU_DIST, 'share', 'qemu', EFI_FIRMWARE_FILE);
    if (fs.existsSync(bundled)) return bundled;
  }
  // Homebrew / system fallback
  return `/opt/homebrew/share/qemu/${EFI_FIRMWARE_FILE}`;
}

// Full path to the qemu-img binary
export function resolveQemuImgBinary(): string {
  const binaryName = PLATFORM === 'win32' ? 'qemu-img.exe' : 'qemu-img';
  if (QEMU_DIST) {
    const bundled = path.join(QEMU_DIST, 'bin', binaryName);
    if (fs.existsSync(bundled)) return bundled;
    const direct = path.join(QEMU_DIST, binaryName);
    if (fs.existsSync(direct)) return direct;
  }
  return binaryName;
}

// ── Directory paths ──────────────────────────────────────────────────────────

export const BASE_DIR = process.env.OPEN_COMPUTER_BASE_DIR ?? path.join(OPEN_COMPUTER_DIR, 'master', 'base_image');
export const AGENTS_DIR = process.env.OPEN_COMPUTER_AGENTS_DIR ?? path.join(OPEN_COMPUTER_DIR, 'agents');
export const SETUP_DIR = path.join(OPEN_COMPUTER_DIR, 'master', 'setup');
export const SERVICE_DIR = path.join(OPEN_COMPUTER_DIR, 'services');
export const VM_DIR = process.env.OPEN_COMPUTER_VM_DIR ?? path.join(OPEN_COMPUTER_DIR, 'master', 'iso');

export const BASE_DISK = path.join(BASE_DIR, 'base.qcow2');
export const BASE_EFI = path.join(BASE_DIR, 'efi-vars.fd');

export function isoPath(): string {
  const arch = GUEST_ARCH === 'aarch64' ? 'arm64' : 'amd64';
  return path.join(VM_DIR, `debian-13.5.0-${arch}-netinst.iso`);
}

// ── VM defaults ──────────────────────────────────────────────────────────────

export const CPUS = 4;
export const RAM = '4G';
export const DISK_SIZE = '40G';
export const VM_USER = 'agent';

// Port allocation bases
export const SSH_PORT_BASE = 2222;
export const VNC_DISPLAY_BASE = 1;
export const APP_PORT_BASE = 9800;

// Path inside the VM where the per-agent .env is staged
export const VM_AGENT_ENV = '/home/agent/agent.env';
