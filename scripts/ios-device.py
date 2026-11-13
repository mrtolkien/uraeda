#!/usr/bin/env python3
"""What `scripts/ios.sh install` needs to sign the app and to find the phone: prints `key=value`
lines, `profile`, `id`, `identity`, `device`, `expires`, or says what is missing and exits 1.

The profile is the newest of Xcode's that names one app and one device and has not expired: the one
Xcode makes for a free account as an app of that bundle ID runs on the phone from Xcode. The bundle
ID is the profile's, so nothing is configured here. The identity is the first "Apple Development"
one of the keychain, and the device the first iPhone or iPad that is connected, or the one named
by `URAEDA_IOS_DEVICE`."""

import datetime
import glob
import json
import os
import plistlib
import re
import subprocess
import sys
import tempfile


def fail(words):
    print(f"[uraeda] {words}", file=sys.stderr)
    sys.exit(1)


def profile():
    folder = os.path.expanduser("~/Library/Developer/Xcode/UserData/Provisioning Profiles")
    found = []
    for path in glob.glob(os.path.join(folder, "*.mobileprovision")):
        decoded = subprocess.run(
            ["security", "cms", "-D", "-i", path], capture_output=True, check=False
        )
        if decoded.returncode != 0:
            continue
        data = plistlib.loads(decoded.stdout)
        app = data.get("Entitlements", {}).get("application-identifier", "")
        _, _, bundle = app.partition(".")
        expires = data["ExpirationDate"]
        if bundle in ("", "*") or bundle.endswith("*"):
            continue
        if not data.get("ProvisionedDevices"):
            continue
        found.append((os.path.getmtime(path), path, bundle, expires))
    if not found:
        fail(
            "no provisioning profile: run an app of the bundle ID you choose on the phone once "
            "from Xcode (see CONTRIBUTING.md, iOS), which makes it"
        )
    now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
    live = [one for one in found if one[3] > now]
    if not live:
        fail(
            "every provisioning profile has expired (a free account's last 7 days): run the "
            "Xcode project's app on the phone once more, which makes a new one"
        )
    _, path, bundle, expires = max(live)
    return path, bundle, expires


def identity():
    listed = subprocess.run(
        ["security", "find-identity", "-v", "-p", "codesigning"],
        capture_output=True,
        text=True,
        check=False,
    ).stdout
    found = re.search(r'"(Apple Development: [^"]+)"', listed)
    if found is None:
        fail("no \"Apple Development\" certificate in the keychain: see CONTRIBUTING.md, iOS")
    return found.group(1)


def device():
    named = os.environ.get("URAEDA_IOS_DEVICE")
    if named:
        return named
    with tempfile.NamedTemporaryFile(suffix=".json") as out:
        subprocess.run(
            ["xcrun", "devicectl", "list", "devices", "--json-output", out.name],
            capture_output=True,
            check=False,
        )
        listed = json.load(open(out.name))
    for one in listed.get("result", {}).get("devices", []):
        hardware = one.get("hardwareProperties", {})
        connection = one.get("connectionProperties", {})
        if hardware.get("platform") != "iOS":
            continue
        if connection.get("tunnelState") in ("connected", "connecting"):
            return one["identifier"]
    fail("no iPhone is connected: plug it in, unlock it, and trust this Mac")


path, bundle, expires = profile()
print(f"profile={path}")
print(f"id={bundle}")
print(f"expires={expires.date()}")
print(f"identity={identity()}")
print(f"device={device()}")
