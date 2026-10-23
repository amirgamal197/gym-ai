#!/usr/bin/env python3
"""
e2e-phase2.py — real-browser checks for the Phase 2 PPL + schedule work.

Optional dev tool (needs: pip install playwright && playwright install chromium).
Serves the project from a temp static server, seeds a *legacy* (pre-Phase-2)
localStorage state, then drives the UI. Run from the project root:

    python3 tools/e2e-phase2.py
"""
import json, os, re, sys, threading, http.server, socketserver, functools

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

ALL_DAYS = ["day1", "day2", "day3", "dayPushA", "dayPullA", "dayLegsA", "dayPushB", "dayPullB", "dayLegsB"]


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

    # ---------- A. legacy user lands on the unchanged Full Body program ----------
    page.goto(BASE + "#program")
    page.wait_for_selector(".program-day-card")
    check("A: legacy user sees 3 program days", page.locator(".program-day-card").count() == 3)
    check("A: first day is still Full Body A", "Full Body A" in page.locator(".program-day-title").first.inner_text())
    check("A: '3 Days' chip active", page.locator('.freq-chip[data-days="3"].active').count() == 1)
    check("A: '6 Days' chip now selectable", page.locator('.freq-chip[data-days="6"]').is_enabled())
    check("A: 2/4/5 Days stay disabled (Soon)", all(page.locator(f'.freq-chip[data-days="{n}"]').is_disabled() for n in (2, 4, 5)))
    check("A: split picker shows 2 options", page.locator(".split-card").count() == 2)
    check("A: Full Body split is active", page.locator('.split-card[data-program="fullbody"].active').count() == 1)
    check("A: 7 weekday buttons, 3 training", page.locator(".week-day").count() == 7 and page.locator(".week-day.on").count() == 3)
    check("A: html is still rtl", page.evaluate("document.documentElement.dir") == "rtl")
    xs = page.evaluate("[...document.querySelectorAll('.week-day')].map(e => e.getBoundingClientRect().x)")
    check("A: RTL week grid starts at the right (Saturday first)", xs[0] > xs[-1])
    check("A: no horizontal overflow @390px", page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"))

    # ---------- B. switch to the 6-day PPL ----------
    page.click('.freq-chip[data-days="6"]')
    check("B: 6 program days", page.locator(".program-day-card").count() == 6)
    titles = [t.strip() for t in page.locator(".program-day-title").all_inner_texts()]
    check("B: PPL titles in order", [t.split("Push")[0] and t for t in titles] and
          all(any(k in titles[i] for k in ks) for i, ks in enumerate([("Push A",), ("Pull A",), ("Legs A",), ("Push B",), ("Pull B",), ("Legs B",)])), str(titles))
    check("B: split badges rendered", page.locator(".split-badge").count() == 6)
    check("B: 6 weekdays on, Friday rest", page.locator(".week-day.on").count() == 6 and "راحة" in page.locator('.week-day[data-weekday="5"]').inner_text())
    check("B: keyboard focus kept on the chip", page.evaluate("document.activeElement && document.activeElement.dataset.days") == "6")
    check("B: no split picker for 6 days (single program)", page.locator(".split-card").count() == 0 and page.locator(".split-note").count() == 1)
    check("B: no horizontal overflow @390px", page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"))
    clipped = page.evaluate("[...document.querySelectorAll('.week-day')].filter(e => e.scrollWidth > e.clientWidth + 1).length")
    check("B: weekday cells do not clip their labels", clipped == 0, f"{clipped} clipped")

    # ---------- C. dashboard reflects the active program ----------
    # Phase 5: the hero is now TODAY's scheduled session, so pin the clock to a
    # Saturday (6-day plan: Saturday = Push A) to keep this check deterministic.
    page.clock.set_system_time("2026-10-24T12:00:00")
    page.goto(BASE + "#dashboard")
    page.reload()
    page.wait_for_selector(".dash-cta")
    check("C: hero points at today's session, Push A (Saturday)", "Push A" in page.locator(".dash-cta-title").inner_text())
    check("C: week strip has 7 cells, 6 training", page.locator(".dash-weekday").count() == 7 and page.locator(".dash-weekday.train").count() == 6)
    check("C: weekly target is 6", "/ 6" in page.locator(".dash-week").first.inner_text())
    check("C: exactly one 'today' cell", page.locator(".dash-weekday.today").count() == 1)

    # ---------- D. a PPL day: render, tick a set, log, save ----------
    page.goto(BASE + "#dayPushA")
    page.reload()
    page.wait_for_selector("#card-dayPushA-main-0")
    check("D: Push A has 6 exercise cards", page.locator('[id^="card-dayPushA-main-"]').count() == 6)
    check("D: heading is Push A", "Push A" in page.locator(".section-title").first.inner_text())
    check("D: first card auto-opened", "open" in (page.locator("#card-dayPushA-main-0").get_attribute("class") or ""))
    first_name = page.locator("#card-dayPushA-main-0 .en").inner_text()
    check("D: first lift resolves from the library (Barbell Bench)", "Bench" in first_name, first_name)
    page.click('.set-box[data-key="dayPushA-main-0"][data-set="0"]')
    page.fill('[data-log="dayPushA-main-0-0-w"]', "60")
    page.fill('[data-log="dayPushA-main-0-0-r"]', "8")
    st = state(page)
    check("D: ticked set persisted under the PPL key", st.get("sets", {}).get("dayPushA-main-0", {}).get("0") is True)
    check("D: logged weight persisted", st.get("logs", {}).get("dayPushA-main-0-0-w") == "60")
    page.click('[data-action="save-session"][data-key="dayPushA-main-0"]')
    st = state(page)
    h = st.get("history", {}).get("dayPushA-main-0", [])
    check("D: history entry saved with dayKey dayPushA", len(h) == 1 and h[0]["dayKey"] == "dayPushA", str(h))
    check("D: save auto-advanced to card 2", "open" in (page.locator("#card-dayPushA-main-1").get_attribute("class") or ""))

    # ---------- E. Gym Mode runs on a PPL day ----------
    page.click('[data-action="open-gym"][data-day="dayPushA"]')
    page.wait_for_timeout(300)
    check("E: gym overlay rendered content", len(page.locator("#gymBody").inner_text().strip()) > 20)
    page.click('[data-action="gym-exit"]')

    # ---------- F. tracker separates same-named exercises by day ----------
    page.goto(BASE + "#tracker")
    page.reload()
    page.wait_for_selector(".rule-card")
    txt = page.locator("main").inner_text()
    check("F: tracker shows legacy Full Body A history", "Full Body A" in txt)
    check("F: tracker shows the new Push A history", "Push A" in txt)

    # ---------- G. 6 -> 3: remembered split, PPL 3-day ----------
    page.goto(BASE + "#program")
    page.reload()
    page.wait_for_selector(".program-day-card")
    page.click('.freq-chip[data-days="3"]')
    check("G: back to 3 days defaults to Full Body", page.locator('.split-card[data-program="fullbody"].active').count() == 1)
    page.click('.split-card[data-program="ppl3"]')
    labels = [t.strip() for t in page.locator(".week-day.on .week-day-label").all_inner_texts()]
    check("G: PPL 3-day week labels Push/Pull/Legs", labels == ["Push", "Pull", "Legs"], str(labels))
    check("G: 3 PPL day cards", page.locator(".program-day-card").count() == 3)
    check("G: split card kept keyboard focus", page.evaluate("document.activeElement && document.activeElement.dataset.program") == "ppl3")

    # ---------- H. editing the weekly schedule ----------
    sat = page.locator('.week-day[data-weekday="6"]')
    sat.click()
    check("H: removing a day shows 2 / 3", "2 / 3" in page.locator(".sched-head").inner_text())
    check("H: incomplete-plan note appears", page.locator(".sched-info").count() == 1)
    check("H: toggled button keeps focus", page.evaluate("document.activeElement.dataset.weekday") == "6")
    page.click('.week-day[data-weekday="0"]')  # add Sunday -> 3/3 again
    check("H: adding back reaches 3 / 3", "3 / 3" in page.locator(".sched-head").inner_text())
    page.click('.week-day[data-weekday="2"]')  # try a 4th day
    check("H: 4th day is refused with an explanation", page.locator(".sched-full").count() == 1 and page.locator(".week-day.on").count() == 3)
    page.click('[data-action="program-reset-schedule"]')
    check("H: reset restores Sat/Mon/Wed", [t.strip() for t in page.locator(".week-day.on .week-day-name").all_inner_texts()] == ["السبت", "الاتنين", "الأربع"])

    # ---------- I. persistence across reload ----------
    page.click('.split-card[data-program="ppl3"]')
    page.click('.week-day[data-weekday="1"]')  # remove Monday
    page.click('.week-day[data-weekday="4"]')  # add Thursday
    state(page)
    page.reload()
    page.wait_for_selector(".week-day")
    check("I: program persisted", page.locator('.split-card[data-program="ppl3"].active').count() == 1)
    on = [t.strip() for t in page.locator(".week-day.on .week-day-name").all_inner_texts()]
    check("I: weekdays persisted", on == ["السبت", "الأربع", "الخميس"], str(on))

    # ---------- J. every day page renders ----------
    for d in ALL_DAYS:
        page.goto(BASE + "#" + d)
        page.reload()
        page.wait_for_selector(f"#sec-{d}")
        n = page.locator(f'[id^="card-{d}-main-"]').count()
        check(f"J: {d} renders main cards", n >= 5, str(n))
        check(f"J: {d} has Gym Mode button + reset", page.locator(f'[data-action="open-gym"][data-day="{d}"]').count() == 1 and page.locator(f'[data-action="reset-day"][data-day="{d}"]').count() == 1)

    # reset-day on a PPL day clears ticks but not logs/history
    page.goto(BASE + "#dayPushA")
    page.reload()
    page.wait_for_selector("#card-dayPushA-main-0")
    page.click('[data-action="reset-day"][data-day="dayPushA"]')
    st = state(page)
    check("J: reset-day cleared the ticked set", not st["sets"]["dayPushA-main-0"].get("0"))
    check("J: reset-day kept logs and history", st["logs"].get("dayPushA-main-0-0-w") == "60" and len(st["history"]["dayPushA-main-0"]) == 1)

    # ---------- K. legacy data survived everything above ----------
    st = state(page)
    check("K: legacy sets intact", st["sets"]["day1-main-0"] == LEGACY["data"]["sets"]["day1-main-0"])
    check("K: legacy logs intact", st["logs"]["day1-main-0-0-w"] == "80" and st["logs"]["day1-main-0-0-r"] == "8")
    check("K: legacy history intact", st["history"]["day1-main-0"] == LEGACY["data"]["history"]["day1-main-0"])

    # ---------- L. corrupt schedule state does not break the app ----------
    # (fresh context: the app flushes in-memory state on pagehide, so
    # injecting into the live page would just be overwritten)
    bad = json.loads(json.dumps(LEGACY))
    bad["data"]["schedule"] = {"programId": "nope", "trainingDays": {"3": [99, "x"]}}
    ctx2 = browser.new_context(viewport={"width": 390, "height": 800})
    ctx2.add_init_script("localStorage.setItem('gymGuide.state', %s);" % json.dumps(json.dumps(bad)))
    page2 = ctx2.new_page()
    errors2 = []
    page2.on("pageerror", lambda e: errors2.append(str(e)))
    page2.goto(BASE + "#program")
    page2.wait_for_selector(".program-day-card")
    check("L: corrupt schedule falls back to Full Body", page2.locator('.split-card[data-program="fullbody"].active').count() == 1 and page2.locator(".program-day-card").count() == 3)
    check("L: corrupt schedule raises no errors", not errors2, "; ".join(errors2[:2]))
    ctx2.close()

    # ---------- M. service worker precache list is complete ----------
    sw = open(os.path.join(ROOT, "service-worker.js"), encoding="utf-8").read()
    mods = [f for f in os.listdir(os.path.join(ROOT, "js", "modules")) if f.endswith(".js")]
    missing = [m for m in mods if f"./js/modules/{m}" not in sw]
    check("M: every imported module is precached", not missing, str(missing))
    check("M: schedule.js precached + cache version bumped", "./js/modules/schedule.js" in sw and re.search(r"gym-guide-shell-v\d+\.\d+\.\d+", sw) is not None)

    check("N: no page/console errors during the whole run", not errors, "; ".join(errors[:3]))
    check("N: no failed HTTP responses", not bad_responses, "; ".join(bad_responses[:3]))
    browser.close()

httpd.shutdown()
if failed:
    print(f"FAIL: {len(failed)} failed, {passed} passed")
    for f in failed:
        print("  ✗", f)
    sys.exit(1)
print(f"OK: {passed}/{passed} browser checks passed")
