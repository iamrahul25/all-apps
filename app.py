"""Interactive launcher for the frontend (Vite) and backend (Cloudflare Worker)."""

import os
import shutil
import signal
import subprocess
import sys
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parent
IS_WINDOWS = os.name == "nt"

SERVICES = {
    "frontend": ["run", "dev:frontend"],
    "backend": ["run", "dev:backend"],
}

COLORS = {"frontend": "\033[36m", "backend": "\033[35m"}
RESET = "\033[0m"

MENU = """
==============================
   Rahul's Digital Shelf
==============================
  1. Start the app (frontend + backend)
  2. Start frontend
  3. Start backend
  0. Exit
"""


def npm_executable() -> str:
    npm = shutil.which("npm.cmd" if IS_WINDOWS else "npm") or shutil.which("npm")
    if not npm:
        sys.exit("npm was not found on PATH. Install Node.js >= 20 first.")
    return npm


def ensure_dependencies(npm: str) -> None:
    if (ROOT / "node_modules").is_dir():
        return
    answer = input("node_modules not found. Run 'npm install' now? [Y/n]: ").strip().lower()
    if answer in ("", "y", "yes"):
        subprocess.run([npm, "install"], cwd=ROOT, check=True)


def start(name: str, npm: str) -> subprocess.Popen:
    kwargs = {}
    if IS_WINDOWS:
        kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
    else:
        kwargs["start_new_session"] = True

    proc = subprocess.Popen(
        [npm, *SERVICES[name]],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        bufsize=1,
        **kwargs,
    )
    threading.Thread(target=stream_output, args=(name, proc), daemon=True).start()
    return proc


def stream_output(name: str, proc: subprocess.Popen) -> None:
    prefix = f"{COLORS[name]}[{name}]{RESET} "
    for line in proc.stdout:
        print(prefix + line, end="", flush=True)


def stop(proc: subprocess.Popen) -> None:
    if proc.poll() is not None:
        return
    # npm spawns child processes (vite / wrangler), so the whole tree must be killed.
    if IS_WINDOWS:
        subprocess.run(
            ["taskkill", "/PID", str(proc.pid), "/T", "/F"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    else:
        try:
            os.killpg(proc.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
    try:
        proc.wait(timeout=10)
    except subprocess.TimeoutExpired:
        proc.kill()


def run(names: list[str]) -> None:
    npm = npm_executable()
    ensure_dependencies(npm)

    procs = {name: start(name, npm) for name in names}
    print(f"\nStarted {', '.join(names)}. Press Ctrl+C to stop.\n")

    try:
        while procs:
            for name, proc in list(procs.items()):
                try:
                    code = proc.wait(timeout=0.5)
                except subprocess.TimeoutExpired:
                    continue
                print(f"\n[{name}] exited with code {code}")
                del procs[name]
    except KeyboardInterrupt:
        print("\nStopping...")
    finally:
        for proc in procs.values():
            stop(proc)
        print("All processes stopped.")


def main() -> None:
    if IS_WINDOWS:
        os.system("")  # enables ANSI colors in the Windows console

    choices = {
        "1": ["frontend", "backend"],
        "2": ["frontend"],
        "3": ["backend"],
    }

    while True:
        print(MENU)
        try:
            choice = input("Select an option: ").strip()
        except (KeyboardInterrupt, EOFError):
            print()
            return

        if choice in ("0", "q", "exit"):
            return
        if choice in choices:
            run(choices[choice])
        else:
            print("Invalid option, try again.")


if __name__ == "__main__":
    main()
