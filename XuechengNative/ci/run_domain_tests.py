"""Run native XCTest on a compatible Codemagic iPhone Simulator."""

import json
import os
import subprocess
from pathlib import Path

from simulator_smoke import run, select_device


root = Path(os.environ["CM_BUILD_DIR"])
output = root / "build" / "test-results"
output.mkdir(parents=True, exist_ok=True)
inventory = json.loads(run("xcrun", "simctl", "list", "devices", "available", "--json"))
_, device = select_device(inventory, "17.0")
udid = device["udid"]
if device.get("state") != "Booted":
    run("xcrun", "simctl", "boot", udid)
run("xcrun", "simctl", "bootstatus", udid, "-b", timeout=300)
command = [
    "xcodebuild", "test", "-project", str(root / "XuechengNative/XuechengNative.xcodeproj"),
    "-scheme", "XuechengNative", "-configuration", "Debug",
    "-destination", f"platform=iOS Simulator,id={udid}",
    # Keep XCTest's test-enabled app build separate from the preceding unsigned
    # smoke artifact build, which uses build/codemagic/XuechengNative.
    "-derivedDataPath", str(root / "build/codemagic/DomainTestsDerivedData"),
    "-resultBundlePath", str(output / "XuechengNativeTests.xcresult"),
    "-parallel-testing-enabled", "NO", "CODE_SIGNING_ALLOWED=NO",
]
print("Running XCTest on", device["name"], udid, flush=True)
with (output / "xctest.log").open("w", encoding="utf-8", errors="replace") as log:
    process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                               text=True, errors="replace")
    for line in process.stdout:
        print(line, end="", flush=True)
        log.write(line)
    status = process.wait()
if status:
    raise SystemExit(status)
