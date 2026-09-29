"""Run against the built Simulator app on macOS; no signing or app changes."""

import argparse
import json
import os
import plistlib
import re
import shlex
import subprocess
import sys
import time
from pathlib import Path


def version(value):
    parts = [int(part) for part in re.findall(r"\d+", value)]
    return tuple((parts + [0, 0, 0])[:3])


def select_device(inventory, minimum_os):
    candidates = []
    for runtime, devices in inventory.get("devices", {}).items():
        if ".iOS-" not in runtime or version(runtime) < version(minimum_os):
            continue
        for device in devices:
            if device.get("isAvailable") and device.get("name", "").startswith("iPhone"):
                candidates.append((runtime, device))
    if not candidates:
        raise RuntimeError("No available iPhone Simulator compatible with iOS " + minimum_os)
    return max(candidates, key=lambda item: (
        item[1].get("state") == "Booted", version(item[0]), item[1]["name"], item[1]["udid"]
    ))


def run(*args, timeout=120):
    print("$ " + shlex.join(args), flush=True)
    try:
        result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                text=True, errors="replace", timeout=timeout)
    except subprocess.TimeoutExpired as error:
        partial = error.stdout or b""
        print(partial.decode(errors="replace") if isinstance(partial, bytes) else partial)
        raise RuntimeError("Command timed out after %ss: %s" % (timeout, shlex.join(args))) from error
    print(result.stdout, end="" if result.stdout.endswith("\n") else "\n", flush=True)
    if result.returncode:
        raise RuntimeError("Command exited %s: %s" % (result.returncode, shlex.join(args)))
    return result.stdout


def launch_pid(output, bundle_id):
    match = re.search(r"^" + re.escape(bundle_id) + r":\s*(\d+)\s*$", output, re.MULTILINE)
    if not match:
        raise RuntimeError("simctl launch did not report an application PID")
    return int(match.group(1))


def check_alive(pid, executable):
    # Simulator apps are host processes. Inspect the exact PID returned by simctl,
    # rather than matching an unrelated process or relaunching a crashed app.
    command = run("/bin/ps", "-p", str(pid), "-o", "command=", timeout=15).strip()
    if executable not in command:
        raise RuntimeError("Launched PID no longer belongs to " + executable)


def diagnostics(udid, executable):
    commands = [("xcrun", "simctl", "list", "devices")]
    if udid:
        commands.append(("xcrun", "simctl", "spawn", udid, "launchctl", "list"))
        if executable:
            commands.append(("xcrun", "simctl", "spawn", udid, "log", "show", "--last", "2m",
                             "--style", "compact", "--predicate", "process == " + json.dumps(executable)))
    for command in commands:
        try:
            run(*command, timeout=30)
        except Exception as error:
            print("Diagnostic unavailable: " + str(error), flush=True)


def smoke(app, output):
    output.mkdir(parents=True, exist_ok=True)
    summary = {"status": "failed", "stage": "validate_app"}
    udid = executable = None
    started = time.monotonic()
    try:
        with (app / "Info.plist").open("rb") as source:
            info = plistlib.load(source)
        bundle_id = info["CFBundleIdentifier"]
        executable = info["CFBundleExecutable"]
        if not (app / executable).is_file():
            raise RuntimeError("App executable is missing: " + executable)
        summary.update(bundle_id=bundle_id, commit=os.environ.get("CM_COMMIT", "unknown"))
        summary["stage"] = "select_device"
        raw = run("xcrun", "simctl", "list", "devices", "available", "--json")
        (output / "devices.json").write_text(raw, encoding="utf-8")
        runtime, device = select_device(json.loads(raw), info.get("MinimumOSVersion", "0"))
        udid = device["udid"]
        summary.update(device=device["name"], udid=udid, runtime=runtime,
                       reused_booted=device.get("state") == "Booted")
        summary["stage"] = "boot"
        if device.get("state") != "Booted":
            run("xcrun", "simctl", "boot", udid)
        run("xcrun", "simctl", "bootstatus", udid, "-b", timeout=300)
        summary["stage"] = "install"
        run("xcrun", "simctl", "install", udid, str(app))
        summary["stage"] = "launch"
        launched = run("xcrun", "simctl", "launch", "--terminate-running-process",
                       "--stdout=" + str(output / "app-stdout.log"),
                       "--stderr=" + str(output / "app-stderr.log"), udid, bundle_id)
        pid = launch_pid(launched, bundle_id)
        summary.update(pid=pid, observation_seconds=8)
        summary["stage"] = "check_alive"
        time.sleep(8)
        check_alive(pid, executable)
        summary["stage"] = "screenshot"
        screenshot = output / "simulator-after-launch.png"
        run("xcrun", "simctl", "io", udid, "screenshot", str(screenshot))
        if not screenshot.is_file() or screenshot.stat().st_size == 0:
            raise RuntimeError("Simulator screenshot is missing or empty")
        check_alive(pid, executable)
        summary.update(status="passed", stage="complete", screenshot=str(screenshot))
        return 0
    except Exception as error:
        summary["error"] = str(error)
        print("SMOKE FAILED: " + str(error), flush=True)
        diagnostics(udid, executable)
        return 1
    finally:
        summary["duration_seconds"] = round(time.monotonic() - started, 2)
        (output / "result.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
        print(json.dumps(summary, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--app", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    sys.exit(smoke(args.app.resolve(), args.output.resolve()))
