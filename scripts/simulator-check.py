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


def elements(udid):
    try:
        return json.loads(idb("ui", "describe-all", "--udid", udid, "--json").stdout)
    except Exception as e:  # noqa: BLE001
        print("describe-all failed:", e, flush=True)
        return []


def tap(udid, label, fallback):
    """tap the element whose accessibility label starts with `label`, else the fallback point (in points)"""
    for el in elements(udid):
        if (el.get("AXLabel") or "").startswith(label):
            f = el["frame"]
            x, y = f["x"] + f["width"] / 2, f["y"] + f["height"] / 2
            break
    else:
        print(f"no element '{label}', tapping fallback {fallback}", flush=True)
        x, y = fallback
    idb("ui", "tap", "--udid", udid, str(round(x)), str(round(y)))
    time.sleep(1)


def launch(udid):
    run("xcrun", "simctl", "boot", udid, check=False)
    run("xcrun", "simctl", "bootstatus", udid, "-b")
    run("xcrun", "simctl", "install", udid, APP)
    seed(udid)
    run("xcrun", "simctl", "launch", udid, BUNDLE)
    idb("connect", udid)
    time.sleep(8)


# ---------- iPhone ----------
phone = device("iPhone")
launch(phone)
# the screen in points (only used when an element can't be found by its label)
app_el = next((e for e in elements(phone) if e.get("type") == "Application"), None)
w, h = (app_el["frame"]["width"], app_el["frame"]["height"]) if app_el else (402, 874)
shot(phone, "phone-01-day")
with open(os.path.join(OUT, "phone-elements.json"), "w") as f:  # what the accessibility tree offers, for fixing taps
    json.dump(elements(phone), f, indent=1)
tap(phone, "Add to", (w - 59, h - 145))  # Day tab + → new block
shot(phone, "phone-02-new-block")
tap(phone, "Close", (w - 40, 120))
tap(phone, "To-do", (w * 0.74, h - 61))
shot(phone, "phone-03-todo")
tap(phone, "Add a to-do", (w - 59, h - 145))
shot(phone, "phone-04-quick-add-keyboard")
idb("ui", "text", "--udid", phone, "Read chapter 3")
idb("ui", "key", "--udid", phone, "40")  # Return: adds, stays open
shot(phone, "phone-05-added")
idb("ui", "key", "--udid", phone, "40")  # Return on an empty line: closes
time.sleep(1)
idb("ui", "swipe", "--udid", phone, str(round(w * 0.8)), "450", str(round(w * 0.15)), "460", "--duration", "0.2")
shot(phone, "phone-06-swiped-next-day")
tap(phone, "Day", (w * 0.26, h - 61))
shot(phone, "phone-07-next-day-timetable")

# ---------- iPad: still the week ----------
ipad = device("iPad")
launch(ipad)
shot(ipad, "ipad-01-week")
print("done", flush=True)
