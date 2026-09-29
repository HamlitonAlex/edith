"""Portable orchestration tests; these do not claim to run an iOS Simulator."""

import json
import plistlib
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import simulator_smoke as smoke


def inventory():
    return {"devices": {
        "com.apple.CoreSimulator.SimRuntime.iOS-17-0": [
            {"name": "iPhone 15", "udid": "existing", "state": "Booted", "isAvailable": True}],
        "com.apple.CoreSimulator.SimRuntime.iOS-26-5": [
            {"name": "iPhone 17", "udid": "new", "state": "Shutdown", "isAvailable": True},
            {"name": "iPad Pro", "udid": "tablet", "state": "Booted", "isAvailable": True},
            {"name": "iPhone unavailable", "udid": "missing", "state": "Booted", "isAvailable": False}],
    }}


class SmokeTests(unittest.TestCase):
    def test_prefers_compatible_booted_iphone(self):
        self.assertEqual(smoke.select_device(inventory(), "17.0")[1]["udid"], "existing")

    def test_ignores_incompatible_booted_device_and_ipad(self):
        self.assertEqual(smoke.select_device(inventory(), "18.0")[1]["udid"], "new")

    def test_no_compatible_iphone_fails(self):
        with self.assertRaisesRegex(RuntimeError, "No available iPhone"):
            smoke.select_device(inventory(), "99.0")

    def test_launch_requires_bundle_specific_pid(self):
        self.assertEqual(smoke.launch_pid("app.xuecheng.nativeui: 123\n", "app.xuecheng.nativeui"), 123)
        with self.assertRaises(RuntimeError):
            smoke.launch_pid("another.app: 123", "app.xuecheng.nativeui")

    def simulate(self, *, crash=False, screenshot=True, minimum="17.0"):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            app = root / "XuechengNative.app"
            app.mkdir()
            (app / "XuechengNative").touch()
            with (app / "Info.plist").open("wb") as target:
                plistlib.dump({"CFBundleIdentifier": "app.xuecheng.nativeui",
                              "CFBundleExecutable": "XuechengNative", "MinimumOSVersion": minimum}, target)
            calls = []

            def fake_run(*command, **kwargs):
                calls.append(command)
                if command[:4] == ("xcrun", "simctl", "list", "devices"):
                    return json.dumps(inventory())
                if command[:3] == ("xcrun", "simctl", "launch"):
                    return "app.xuecheng.nativeui: 123\n"
                if command[0] == "/bin/ps":
                    if crash:
                        raise RuntimeError("Process 123 has exited")
                    return str(app / "XuechengNative")
                if command[:3] == ("xcrun", "simctl", "io") and screenshot:
                    Path(command[-1]).write_bytes(b"test screenshot fixture")
                return ""

            with patch.object(smoke, "run", side_effect=fake_run), patch.object(smoke.time, "sleep"):
                code = smoke.smoke(app, root / "output")
            result = json.loads((root / "output" / "result.json").read_text(encoding="utf-8"))
            return code, result, calls

    def test_success_reuses_booted_and_captures_screenshot(self):
        code, result, calls = self.simulate()
        self.assertEqual(code, 0)
        self.assertEqual(result["status"], "passed")
        self.assertFalse(any(c[:3] == ("xcrun", "simctl", "boot") for c in calls))
        self.assertEqual(sum(c[0] == "/bin/ps" for c in calls), 2)

    def test_shutdown_device_is_booted_before_install(self):
        code, result, calls = self.simulate(minimum="18.0")
        self.assertEqual(code, 0)
        self.assertLess(calls.index(("xcrun", "simctl", "boot", "new")),
                        next(i for i, c in enumerate(calls) if c[:3] == ("xcrun", "simctl", "install")))

    def test_crash_fails_and_collects_diagnostics(self):
        code, result, calls = self.simulate(crash=True)
        self.assertEqual(code, 1)
        self.assertEqual(result["stage"], "check_alive")
        self.assertTrue(any("launchctl" in c for c in calls))
        self.assertFalse(any(c[:3] == ("xcrun", "simctl", "io") for c in calls))

    def test_missing_screenshot_cannot_pass(self):
        code, result, _ = self.simulate(screenshot=False)
        self.assertEqual(code, 1)
        self.assertEqual(result["stage"], "screenshot")


if __name__ == "__main__":
    unittest.main()
