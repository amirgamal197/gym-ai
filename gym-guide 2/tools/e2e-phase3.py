#!/usr/bin/env python3
"""
e2e-phase3.py — real-browser checks for the Phase 3 library expansion.

Phase 3 adds NO new UI (the alternatives button is Phase 4). What a browser
can still prove is that the enlarged exercise library (155 exercises, 21 of
them resistance-band) renders and filters correctly, that new exercises
without an illustration link degrade cleanly, that favourites work for them,
and that a legacy saved state is not touched.

Optional dev tool (needs: pip install playwright && playwright install chromium).
Run from the project root:   python3 tools/e2e-phase3.py
"""
import json, os, sys, threading, http.server, socketserver, functools

from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
passed, failed = 0, []


def check(name, cond, detail=""):
    global passed
    if cond:
        passed += 1
    else:
        failed.append(f"{name}" + (f" — {detail}" if detail else ""))


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


handler = functools.partial(Quiet, directory=ROOT)
socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)
PORT = httpd.server_address[1]
threading.Thread(target=httpd.serve_forever, daemon=True).start()
BASE = f"http://127.0.0.1:{PORT}/index.html"

LEGACY = {
    "version": 1,
    "data": {
        "programDaysPerWeek": 3,
        "sets": {"day1-main-0": {"0": True, "1": True, "2": True}},
        "logs": {"day1-main-0-0-w": "80", "day1-main-0-0-r": "8"},
        "history": {
            "day1-main-0": [
                {"date": "1/9/2026", "dateISO": "2026-09-01", "dayKey": "day1", "volume": 640, "best1rm": 101, "name": "Back Squat"}
            ]
        },
    },
}
SEED = """
if (!localStorage.getItem('__seeded')) {
  localStorage.setItem('gymGuide.state', %s);
  localStorage.setItem('__seeded', '1');
}
""" % json.dumps(json.dumps(LEGACY))


def state(page):
    page.wait_for_timeout(700)  # storage debounce is 250ms
    raw = page.evaluate("localStorage.getItem('gymGuide.state')")
    return json.loads(raw)["data"] if raw else {}


with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 390, "height": 800})
    ctx.add_init_script(SEED)
    page = ctx.new_page()
    errors, bad_responses = [], []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("response", lambda r: bad_responses.append(f"{r.status} {r.url}") if r.status >= 400 else None)

    page.goto(BASE + "#exercises")
    page.wait_for_selector("#exerciseListContainer .ex-card")

    # ---------- A. the whole library renders ----------
    total = page.locator("#exerciseListContainer .ex-card").count()
    check("A: all 155 exercises render in the library tab", total == 155, str(total))
    check("A: Band is an equipment filter option", page.locator('#exEquipmentFilter option[value="Band"]').count() == 1)

    # ---------- B. equipment filter: Band ----------
    page.select_option("#exEquipmentFilter", "Band")
    page.wait_for_timeout(150)
    band_cards = page.locator("#exerciseListContainer .ex-card").count()
    check("B: Band filter shows the 21 band exercises", band_cards == 21, str(band_cards))
    quick = page.locator("#exerciseListContainer .ex-quickmeta").all_inner_texts()
    check("B: every band card is labelled with the Arabic band equipment name", all("حزام مقاومة" in q for q in quick), str(quick[:2]))

    # ---------- C. search + expand a new exercise ----------
    page.select_option("#exEquipmentFilter", "all")
    page.fill("#exerciseSearch", "Band Chest Press")
    page.wait_for_timeout(250)
    check("C: search finds exactly the Band Chest Press", page.locator("#exerciseListContainer .ex-card").count() == 1)
    page.click("#exerciseListContainer .ex-head")
    page.wait_for_timeout(250)
    body = page.locator("#exerciseListContainer .ex-body").first
    check("C: expanded card lists the 3 instructions", body.locator("li").count() >= 3, str(body.locator("li").count()))
    check("C: no illustration link for an exercise without a verified one", body.locator("a", has_text="Illustration").count() == 0)
    check("C: YouTube tutorial link still offered", body.locator("a[href*='youtube']").count() >= 1)
    check("C: no horizontal overflow @390px", page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"))

    # ---------- D. favourites on a new exercise ----------
    page.click('.fav-star[data-id="band-chest-press"]')
    st = state(page)
    check("D: favourite stored under the new stable id", (st.get("favorites") or {}).get("band-chest-press") is True)

    # ---------- E. muscle filter on a group that gained exercises ----------
    page.fill("#exerciseSearch", "")
    page.click('#groupChipRow [data-value="traps"]')
    page.wait_for_timeout(250)
    traps = page.locator("#exerciseListContainer .ex-card").count()
    check("E: traps group now lists the 2 new shrug options (8 total)", traps == 8, str(traps))

    # ---------- F. legacy data untouched ----------
    st = state(page)
    check("F: legacy sets untouched", st.get("sets", {}).get("day1-main-0") == {"0": True, "1": True, "2": True})
    check("F: legacy logs untouched", st.get("logs", {}).get("day1-main-0-0-w") == "80" and st["logs"].get("day1-main-0-0-r") == "8")
    check("F: legacy history untouched", len(st.get("history", {}).get("day1-main-0", [])) == 1 and st["history"]["day1-main-0"][0]["volume"] == 640)

    # ---------- G. program/day pages still render (library lookups) ----------
    page.goto(BASE + "#program")
    page.wait_for_selector(".program-day-card")
    check("G: program page renders 3 legacy days", page.locator(".program-day-card").count() == 3)
    check("G: html is still rtl", page.evaluate("document.documentElement.dir") == "rtl")

    # ---------- H. service worker ----------
    sw = open(os.path.join(ROOT, "service-worker.js"), encoding="utf-8").read()
    check("H: exercises-data.js precached and cache version bumped", "./js/modules/exercises-data.js" in sw and "gym-guide-shell-v1.16.0" in sw)
    check("H: exercise-alternatives.js is precached now that Phase 4 imports it", "./js/modules/exercise-alternatives.js" in sw)

    check("I: no page/console errors during the whole run", not errors, "; ".join(errors[:3]))
    check("I: no failed HTTP responses", not bad_responses, "; ".join(bad_responses[:3]))
    browser.close()

httpd.shutdown()
if failed:
    print(f"FAIL: {len(failed)} failed, {passed} passed")
    for f in failed:
        print("  ✗", f)
    sys.exit(1)
print(f"OK: {passed}/{passed} browser checks passed")
