#!/usr/bin/env python3
"""Open the iOS app in an iPhone and an iPad simulator, tap through the main flows and save screenshots.

Runs in the "Simulator check" workflow (macOS runner, after `tauri ios build --debug --target aarch64-sim`).
Taps go through idb (fb-idb + idb-companion), so they count as real touches: the keyboard comes up like on a phone.
Usage: simulator-check.py <path to Timetable.app> <output folder>
"""
import datetime, json, os, subprocess, sys, time

APP, OUT = sys.argv[1], sys.argv[2]
BUNDLE = "com.maxsalmon.timetable"
os.makedirs(OUT, exist_ok=True)


def run(*cmd, check=True):
    print("$", " ".join(cmd), flush=True)
    r = subprocess.run(cmd, check=False, capture_output=True, text=True)
    if r.returncode:
        print(r.stdout[-2000:], r.stderr[-2000:], flush=True)
        if check:
            raise SystemExit(f"failed: {' '.join(cmd)}")
    return r


def idb(*args):
    """a tap/typing step; a failure is reported but doesn't stop the screenshots"""
    return run("idb", *args, check=False)


def device(kind):
    """the newest available simulator whose name starts with kind ('iPhone' / 'iPad')"""
    devs = json.loads(run("xcrun", "simctl", "list", "devices", "available", "-j").stdout)["devices"]
    found = [d for rt, ds in devs.items() if "iOS" in rt for d in ds if d["name"].startswith(kind)]
    pick = next((d for d in found if d["name"] in ("iPhone 17", "iPhone 16", "iPad Pro 13-inch (M5)", "iPad Pro 13-inch (M4)")), None) or found[-1]
    print(f"{kind}: {pick['name']} {pick['udid']}", flush=True)
    return pick["udid"]


def seed(udid):
    """a day with blocks and to-dos, written where the app keeps its plans (Documents/Timetable Plans)"""
    today = datetime.date.today()
    monday = today - datetime.timedelta(days=today.weekday())
    iso = today.isoformat()
    data = {
        "version": 4,
        "activities": [
            {"id": "lec", "name": "Lecture", "color": "#A9D6FF", "duration": 120, "icon": "chalkboard-teacher"},
            {"id": "gym", "name": "Gym", "color": "#A8E8BF", "duration": 60, "icon": "barbell"},
            {"id": "fr", "name": "Friends", "color": "#FFB8D6", "duration": 120, "icon": "users-three"},
        ],
        "blocks": [
            {"id": "b1", "date": iso, "start": 600, "end": 720, "title": "Lecture", "color": "#A9D6FF", "tag": "lec", "icon": "chalkboard-teacher"},
            {"id": "b2", "date": iso, "start": 780, "end": 840, "title": "Gym", "color": "#A8E8BF", "tag": "gym", "icon": "barbell"},
            {"id": "b3", "date": iso, "start": 1080, "end": 1230, "title": "Dinner with Aoi", "color": "#FFB8D6", "tag": "fr", "icon": "users-three"},
        ],
        "templates": [],
        "todos": {monday.isoformat(): [[] for _ in range(7)]},
    }
    data["todos"][monday.isoformat()][today.weekday()] = [
        {"id": "t1", "text": "Email tutor about essay", "done": False},
        {"id": "t2", "text": "Buy birthday card", "done": True},
    ]
    container = run("xcrun", "simctl", "get_app_container", udid, BUNDLE, "data").stdout.strip()
    folder = os.path.join(container, "Documents", "Timetable Plans")
    os.makedirs(folder, exist_ok=True)
    with open(os.path.join(folder, "timetable.json"), "w") as f:
        json.dump(data, f)


def shot(udid, name):
    time.sleep(1.5)
    run("xcrun", "simctl", "io", udid, "screenshot", os.path.join(OUT, name + ".png"))


def grab(udid):
    path = os.path.join(OUT, ".probe.png")
    run("xcrun", "simctl", "io", udid, "screenshot", path)
    with open(path, "rb") as f:
        return f.read()


def tap(udid, x, y, expect_change=False):
    """with expect_change, tap again (once) if the screen didn't change: simulated taps are sometimes dropped"""
    before = grab(udid) if expect_change else None
    idb("ui", "tap", "--udid", udid, str(round(x)), str(round(y)))
    time.sleep(1.5)
    if expect_change and grab(udid) == before:
        print(f"RETAP: nothing changed after tapping ({round(x)}, {round(y)})", flush=True)
        idb("ui", "tap", "--udid", udid, str(round(x)), str(round(y)))
        time.sleep(1.5)


def swipe(udid, x1, y1, x2, y2):
    idb("ui", "swipe", "--udid", udid, str(round(x1)), str(round(y1)), str(round(x2)), str(round(y2)), "--duration", "0.3")
    time.sleep(1)


def screen(udid):
    """the screen in points, from the accessibility tree (the web content itself isn't in it, so taps go by position)"""
    try:
        app = json.loads(idb("ui", "describe-all", "--udid", udid, "--json").stdout)[0]["frame"]
        return app["width"], app["height"]
    except Exception:  # noqa: BLE001
        return 402, 874


def launch(udid):
    run("xcrun", "simctl", "boot", udid, check=False)
    run("xcrun", "simctl", "bootstatus", udid, "-b")
    run("xcrun", "simctl", "install", udid, APP)
    seed(udid)
    run("xcrun", "simctl", "launch", udid, BUNDLE)
    idb("connect", udid)
    time.sleep(8)


# ---------- iPhone ----------
# the on-screen keyboard, as on a phone (the simulator otherwise assumes the Mac's keyboard and hides it)
run("defaults", "write", "com.apple.iphonesimulator", "ConnectHardwareKeyboard", "-bool", "false", check=False)
phone = device("iPhone")
launch(phone)
w, h = screen(phone)
fab = (w - 59, h - 145)  # the + over the list
day_tab, todo_tab = (w * 0.26, h - 61), (w * 0.74, h - 61)
shot(phone, "phone-01-day")
tap(phone, *fab, expect_change=True)  # Day tab + → new block
shot(phone, "phone-02-new-block")
tap(phone, w - 40, 120, expect_change=True)  # outside the sheet, over the next-day button: closes, must not change the day
shot(phone, "phone-03-closed-same-day")
tap(phone, *todo_tab, expect_change=True)
shot(phone, "phone-04-todo")
tap(phone, *fab, expect_change=True)  # To-do tab + → pop-up with the keyboard
shot(phone, "phone-05-quick-add-keyboard")
idb("ui", "text", "--udid", phone, "Read chapter 3")
idb("ui", "key", "--udid", phone, "40")  # Return: adds, stays open
shot(phone, "phone-06-added")
idb("ui", "key", "--udid", phone, "40")  # Return on an empty line: closes
shot(phone, "phone-07-closed")
swipe(phone, w * 0.85, h * 0.5, w * 0.1, h * 0.5 + 10)  # → next day
shot(phone, "phone-08-swiped-next-day")
tap(phone, *day_tab, expect_change=True)
shot(phone, "phone-09-next-day-timetable")
swipe(phone, w * 0.1, h * 0.5, w * 0.85, h * 0.5 + 10)  # ← back
shot(phone, "phone-10-swiped-back")

# ---------- iPad: still the week ----------
ipad = device("iPad")
launch(ipad)
shot(ipad, "ipad-01-week")
print("done", flush=True)
