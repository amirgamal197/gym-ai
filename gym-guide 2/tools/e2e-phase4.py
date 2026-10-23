#!/usr/bin/env python3
"""
e2e-phase4.py — real-browser checks for the Phase 4 alternatives sheet and safe replacement.

Covers: the Alternatives button on day cards / Gym Mode / library cards, the sheet
(modal behaviour, focus, Esc, Tab trap), equipment-aware default + category filters,
close vs partial explanations, the partial-only note, same-day duplicate hiding, the
confirm step, and — most importantly — that replacing an exercise mid-session keeps
completed sets, weights, reps and history (restorable), survives a reload, and
leaves neighbouring exercises and legacy data untouched.

Optional dev tool (needs: pip install playwright && playwright install chromium).
Run from the project root:   python3 tools/e2e-phase4.py
"""
import json, os, sys, threading, http.server, socketserver, functools

from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SHOTS = os.environ.get("E2E_SHOTS")  # optional directory for screenshots
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

SLOT = "dayPushA-main-0"
ORIG = "flat-barbell-bench"
SEED_STATE = {
    "version": 1,
    "data": {
        "programDaysPerWeek": 3,
        "profile": {"equipment": ["dumbbells", "bodyweight"]},
        "sets": {
            SLOT: {"0": True, "1": True},
            "dayPushA-main-1": {"0": True},
            "day1-main-0": {"0": True, "1": True, "2": True},
        },
        "logs": {
            SLOT + "-0-w": "60", SLOT + "-0-r": "8", SLOT + "-1-w": "60", SLOT + "-1-r": "7", SLOT + "-rpe": "8",
            "dayPushA-main-1-0-w": "22", "dayPushA-main-1-0-r": "10",
            "day1-main-0-0-w": "80", "day1-main-0-0-r": "8",
        },
        "history": {
            SLOT: [{"date": "1/9/2026", "dateISO": "2026-09-01", "dayKey": "dayPushA", "volume": 480, "best1rm": 76, "name": "Flat Barbell Bench"}],
            "dayPushA-main-1": [{"date": "2/9/2026", "dateISO": "2026-09-02", "dayKey": "dayPushA", "volume": 600, "best1rm": 80, "name": "Incline DB Press"}],
            "day1-main-0": [{"date": "1/9/2026", "dateISO": "2026-09-01", "dayKey": "day1", "volume": 640, "best1rm": 101, "name": "Back Squat"}],
        },
    },
}
SEED = """
if (!localStorage.getItem('__seeded')) {
  localStorage.setItem('gymGuide.state', %s);
  localStorage.setItem('__seeded', '1');
}
""" % json.dumps(json.dumps(SEED_STATE))


def state(page):
    page.wait_for_timeout(700)  # storage debounce is 250ms
    raw = page.evaluate("localStorage.getItem('gymGuide.state')")
    return json.loads(raw)["data"] if raw else {}


def shot(page, name):
    page.wait_for_timeout(400)  # let the open animation finish
    if SHOTS:
        os.makedirs(SHOTS, exist_ok=True)
        page.screenshot(path=os.path.join(SHOTS, name + ".png"))


def open_card_alt(page, idx):
    sel = f"#card-dayPushA-main-{idx}"
    if "open" not in (page.get_attribute(sel, "class") or ""):
        page.click(f"{sel} .ex-head")
        page.wait_for_timeout(300)
    page.click(f"{sel} .alt-btn")
    page.wait_for_selector("#altSheet:not([hidden]) .alt-body")


with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 390, "height": 800})
    ctx.add_init_script(SEED)
    page = ctx.new_page()
    errors, bad = [], []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("response", lambda r: bad.append(f"{r.status} {r.url}") if r.status >= 400 else None)

    # ---------- A. day page shows the button on every main card ----------
    page.goto(BASE + "#dayPushA")
    page.wait_for_selector("#card-dayPushA-main-0")
    check("A: one Alternatives button per main exercise (6)", page.locator("#sec-dayPushA .alt-btn").count() == 6, str(page.locator("#sec-dayPushA .alt-btn").count()))
    check("A: warm-up/cool-down cards do not get the button", page.locator("#sec-dayPushA .ex-card:not([id*='-main-']) .alt-btn").count() == 0)
    check("A: seeded completed sets still hydrate (2 done on bench)", page.locator(f"#card-{SLOT} .set-box.done").count() == 2)
    orig_name = page.inner_text(f"#card-{SLOT} .ex-titles .en").strip()
    other_names = [page.inner_text(f"#card-dayPushA-main-{i} .ex-titles .en").strip() for i in range(1, 6)]

    # ---------- B. open the sheet: modal semantics ----------
    open_card_alt(page, 0)
    check("B: sheet is a labelled modal dialog", page.get_attribute("#altPanel", "role") == "dialog" and page.get_attribute("#altPanel", "aria-modal") == "true")
    check("B: title names the feature", "Alternatives" in page.inner_text("#altTitle"))
    check("B: source exercise shown with muscle + pattern tags", orig_name in page.inner_text("#altPanel .alt-source") and page.locator("#altPanel .alt-source .alt-tag").count() >= 3)
    check("B: background is inert while open", page.get_attribute("#mainContent", "inert") is not None and "alt-open" in page.get_attribute("body", "class"))
    check("B: focus moved into the dialog", page.evaluate("document.getElementById('altPanel').contains(document.activeElement)"))
    shot(page, "01-sheet-list-390")

    # ---------- C. equipment-aware default (profile: dumbbells + bodyweight) ----------
    check("C: 'my equipment only' defaults ON when the profile lists equipment", page.get_attribute(".alt-toggle", "aria-checked") == "true")
    tags = page.locator("#altPanel .alt-item .alt-tag").all_inner_texts()
    check("C: no barbell / machine / cable / band items while filtered to my equipment", not any(t in ("بار حديد", "أجهزة", "كابلات", "أحبال مقاومة") for t in tags), str(sorted(set(tags))))
    check("C: dumbbell alternatives are offered", any(t == "دمبلز" for t in tags))
    check("C: hidden-by-equipment count is explained", "مخفي لأنه محتاج معدات" in page.inner_text("#altPanel .alt-body"))
    page.click('[data-action="alt-toggle-mine"]')
    page.wait_for_timeout(100)
    tags_all = page.locator("#altPanel .alt-item .alt-tag").all_inner_texts()
    check("C: toggling off reveals barbell/machine/cable/band items", all(any(t == x for t in tags_all) for x in ("بار حديد", "أجهزة", "كابلات")))
    check("C: toggle keeps keyboard focus", page.evaluate("document.activeElement.dataset.action") == "alt-toggle-mine")

    # ---------- D. category filters ----------
    labels = page.locator(".alt-filter").all_inner_texts()
    check("D: filter chips include All + categories with counts", len(labels) >= 5 and labels[0].startswith("الكل"), str(labels))
    page.click('.alt-filter[data-cat="cable"]')
    items = page.locator("#altPanel .alt-item")
    n_cable = items.count()
    check("D: cable filter shows only cable items", n_cable > 0 and all("كابلات" in items.nth(i).inner_text() for i in range(n_cable)), str(n_cable))
    check("D: pressed state exposed to assistive tech", page.get_attribute('.alt-filter[data-cat="cable"]', "aria-pressed") == "true")
    page.click('.alt-filter[data-cat="home"]')
    n_home = page.locator("#altPanel .alt-item").count()
    check("D: home filter shows only home items, each badged", n_home > 0 and page.locator("#altPanel .alt-item .alt-tag-home").count() == n_home, f"{n_home} vs {page.locator('#altPanel .alt-item .alt-tag-home').count()}")
    page.click('.alt-filter[data-cat="all"]')

    # ---------- E. explanations + tiers + same-day duplicates ----------
    close_n = page.locator(".alt-item-close").count()
    part_n = page.locator(".alt-item-partial").count()
    check("E: both close and partial sections are populated for the bench", close_n > 0 and part_n > 0, f"{close_n}/{part_n}")
    check("E: close items are labelled 'بديل قريب'", all("بديل قريب" in t for t in page.locator(".alt-item-close .alt-tier").all_inner_texts()))
    check("E: partial items are labelled 'بديل جزئي'", all("بديل جزئي" in t for t in page.locator(".alt-item-partial .alt-tier").all_inner_texts()))
    expl = page.locator("#altPanel .alt-explain").all_inner_texts()
    check("E: every item explains muscle + movement", expl and all(("نفس العضلة" in t or "بيركّز على" in t) and ("نمط الحركة" in t or "حركة مختلفة" in t) for t in expl))
    listed = page.locator("#altPanel .alt-item .alt-en").all_inner_texts()
    check("E: exercises already in this day are never offered", not any(n in listed for n in other_names), str([n for n in other_names if n in listed]))
    check("E: the source exercise itself is not offered", orig_name not in listed)
    check("E: hidden same-day exercises are explained", "موجود فعلًا في اليوم ده" in page.inner_text("#altPanel .alt-body"))
    # Arabic RTL layout: close button sits at the physical left
    cb = page.locator(".alt-close").bounding_box()
    tb = page.locator("#altTitle").bounding_box()
    check("E: RTL — close button on the left of the title", cb["x"] < tb["x"])
    check("E: no horizontal overflow inside the sheet @390px", page.evaluate("(()=>{const b=document.querySelector('.alt-body');return b.scrollWidth<=b.clientWidth+1})()"))

    # ---------- F. confirm step does not change anything yet ----------
    pick = page.locator(".alt-item-close .alt-pick").first
    new_id = pick.get_attribute("data-id")
    new_label = pick.get_attribute("aria-label")
    pick.click()
    page.wait_for_selector(".alt-confirm")
    body = page.inner_text("#altPanel .alt-body")
    check("F: confirm view states what is kept (2 completed sets, no deletion)", "2 سيت مكتمل" in body and "مش هيتمسحوا" in body, body[:200])
    check("F: confirm view says the new exercise starts clean and can be undone", "هتبدأ من الصفر" in body and "ترجّع التمرين الأصلي" in body)
    check("F: confirm view shows prescription kept", "4×6-8" in body)
    shot(page, "02-sheet-confirm-390")
    st = state(page)
    check("F: nothing is written before confirming", "exerciseOverrides" not in st and st["sets"][SLOT] == {"0": True, "1": True})
    page.keyboard.press("Escape")
    page.wait_for_timeout(100)
    check("F: Esc in the confirm view goes back to the list, not out of the sheet", page.locator(".alt-list").count() >= 1 and not page.locator("#altSheet").get_attribute("hidden"))
    page.locator(f'.alt-pick[data-id="{new_id}"]').click()
    page.wait_for_selector(".alt-confirm")
    page.click('[data-action="alt-back"]')
    page.wait_for_selector(".alt-list")
    check("F: 'back' returns to the list", True)
    page.locator(f'.alt-pick[data-id="{new_id}"]').click()
    page.wait_for_selector(".alt-confirm")

    # ---------- G. confirm the replacement ----------
    page.click('[data-action="alt-confirm"]')
    page.wait_for_selector("#altSheet", state="hidden")
    check("G: sheet closed, page interactive again", page.get_attribute("#mainContent", "inert") is None and "alt-open" not in (page.get_attribute("body", "class") or ""))
    new_name = page.inner_text(f"#card-{SLOT} .ex-titles .en").strip()
    check("G: card 0 now shows the replacement", new_name != orig_name and new_name in (new_label or ""), f"{orig_name} -> {new_name}")
    check("G: replacement card is badged and notes what it replaced", page.locator(f"#card-{SLOT} .badge-swap").count() == 1 and orig_name in page.inner_text(f"#card-{SLOT} .swap-note"))
    check("G: replacement starts with no completed sets, same number of sets", page.locator(f"#card-{SLOT} .set-box").count() == 4 and page.locator(f"#card-{SLOT} .set-box.done").count() == 0)
    check("G: replacement's log inputs start empty", all(v == "" for v in page.eval_on_selector_all(f"#card-{SLOT} [data-log]", "els=>els.map(e=>e.value)")))
    check("G: replacement shows library coaching (not the bench's)", page.locator(f"#card-{SLOT} .why, #card-{SLOT} .tip").count() >= 1)
    check("G: neighbouring exercise kept its completed set and weight", page.locator("#card-dayPushA-main-1 .set-box.done").count() == 1 and page.input_value('[data-log="dayPushA-main-1-0-w"]') == "22")
    check("G: toast announces the swap", "اتبدّل" in page.inner_text("#altToast"))
    check("G: keyboard focus lands on the new card's Alternatives button", page.evaluate("document.activeElement.classList.contains('alt-btn')"))
    st = state(page)
    ov = st["exerciseOverrides"]["dayPushA"]["0"]
    check("G: override stored with the original id", ov["id"] == new_id and ov["originalId"] == ORIG)
    arch = SLOT + "~" + ORIG
    check("G: completed sets preserved under the old exercise", st["sets"].get(arch) == {"0": True, "1": True}, str(st["sets"].get(arch)))
    check("G: weights/reps/RPE preserved", all(st["logs"].get(arch + s) == v for s, v in {"-0-w": "60", "-0-r": "8", "-1-w": "60", "-1-r": "7", "-rpe": "8"}.items()))
    h = st["history"].get(arch, [])
    check("G: old history kept + today's partial work recorded", len(h) == 2 and h[0]["volume"] == 480 and h[1].get("partial") is True and h[1]["exerciseId"] == ORIG and h[1]["setsDone"] == 2 and h[1]["volume"] == 900, str(h))
    check("G: slot history cleared for the new exercise", SLOT not in st["history"])
    check("G: neighbouring + legacy data byte-identical", st["sets"]["dayPushA-main-1"] == {"0": True} and st["history"]["dayPushA-main-1"] == SEED_STATE["data"]["history"]["dayPushA-main-1"] and st["sets"]["day1-main-0"] == {"0": True, "1": True, "2": True} and st["history"]["day1-main-0"][0]["volume"] == 640)
    check("G: 'day complete' state not wrongly shown", page.locator(".day-complete-banner").count() == 0)

    # ---------- H. reload keeps the replacement ----------
    page.reload()
    page.wait_for_selector(f"#card-{SLOT}")
    check("H: replacement survives a reload", page.inner_text(f"#card-{SLOT} .ex-titles .en").strip() == new_name and page.locator(f"#card-{SLOT} .badge-swap").count() == 1)

    # ---------- I. log work on the replacement, tracker shows both ----------
    page.click(f"#card-{SLOT} .set-box >> nth=0")
    page.fill(f'[data-log="{SLOT}-0-w"]', "28")
    page.fill(f'[data-log="{SLOT}-0-r"]', "10")
    page.wait_for_timeout(600)
    st = state(page)
    check("I: new work is stored under the slot key, old data still archived", st["sets"][SLOT] == {"0": True} and st["logs"][SLOT + "-0-w"] == "28" and st["sets"][SLOT + "~" + ORIG] == {"0": True, "1": True})
    page.goto(BASE + "#tracker")
    page.wait_for_selector(".rule-card")
    tracker = page.inner_text("#mainContent")
    check("I: tracker lists the swapped-out exercise with its full history", "Flat Barbell Bench" in tracker and "تمرين اتبدّل" in tracker and "جزئية" in tracker)
    check("I: tracker still lists the neighbouring + legacy exercises", "Incline DB Press" in tracker and "Back Squat" in tracker)

    # ---------- J. restore the original ----------
    page.goto(BASE + "#dayPushA")
    page.wait_for_selector(f"#card-{SLOT}")
    open_card_alt(page, 0)
    check("J: replaced slot shows a restore banner", "رجّع التمرين الأصلي" in page.inner_text("#altPanel .alt-note-swap"))
    page.click(".alt-note-swap .alt-link")
    page.wait_for_selector(".alt-confirm")
    check("J: restore confirm says the old sets come back", "هترجع زي ما كانت" in page.inner_text(".alt-keep"))
    page.click('[data-action="alt-confirm"]')
    page.wait_for_selector("#altSheet", state="hidden")
    check("J: original exercise is back with its 2 completed sets", page.inner_text(f"#card-{SLOT} .ex-titles .en").strip() == orig_name and page.locator(f"#card-{SLOT} .set-box.done").count() == 2 and page.locator(f"#card-{SLOT} .badge-swap").count() == 0)
    check("J: original weights are back in the inputs", page.input_value(f'[data-log="{SLOT}-0-w"]') == "60" and page.input_value(f'[data-log="{SLOT}-1-r"]') == "7")
    st = state(page)
    check("J: override removed from state", "dayPushA" not in st.get("exerciseOverrides", {}))
    check("J: the replacement's work was archived, not dropped", st["sets"].get(SLOT + "~" + new_id) == {"0": True} and st["logs"].get(SLOT + "~" + new_id + "-0-w") == "28")

    # ---------- K. keyboard + focus behaviour ----------
    opener = page.locator(f"#card-{SLOT} .alt-btn")
    opener.focus()
    page.keyboard.press("Enter")
    page.wait_for_selector("#altSheet:not([hidden]) .alt-body")
    inside = True
    for _ in range(25):
        page.keyboard.press("Tab")
        inside = inside and page.evaluate("document.getElementById('altPanel').contains(document.activeElement)")
    check("K: Tab never leaves the dialog (focus trap)", inside)
    inside = True
    for _ in range(5):
        page.keyboard.press("Shift+Tab")
        inside = inside and page.evaluate("document.getElementById('altPanel').contains(document.activeElement)")
    check("K: Shift+Tab stays in the dialog too", inside)
    page.keyboard.press("Escape")
    page.wait_for_selector("#altSheet", state="hidden")
    check("K: Esc closes the sheet and focus returns to the opener", page.evaluate(f"document.activeElement === document.querySelector('#card-{SLOT} .alt-btn')"))
    open_card_alt(page, 0)
    page.click(".alt-backdrop", position={"x": 5, "y": 5})
    page.wait_for_selector("#altSheet", state="hidden")
    check("K: tapping the backdrop closes the sheet", True)

    # ---------- M. Gym Mode ----------
    page.goto(BASE + "#dayPushA")
    page.wait_for_selector(f"#card-{SLOT}")
    page.click('[data-action="open-gym"]')
    page.wait_for_selector("#gymOverlay.active")
    for _ in range(12):
        if page.locator("#gymBody .alt-btn").count():
            break
        page.click('[data-action="gym-next"]')
        page.wait_for_timeout(60)
    check("M: Gym Mode main phase has an Alternatives button", page.locator("#gymBody .alt-btn").count() == 1)
    gym_title_before = page.inner_text("#gymBody .gym-ex-title").strip()
    check("M: Gym Mode starts the main phase on the first exercise", gym_title_before == orig_name, gym_title_before)
    page.click("#gymBody .alt-btn")
    page.wait_for_selector("#altSheet:not([hidden]) .alt-body")
    z_ok = page.evaluate("(()=>{const r=document.getElementById('altPanel').getBoundingClientRect();const e=document.elementFromPoint(r.left+r.width/2,r.top+40);return document.getElementById('altPanel').contains(e)})()")
    check("M: the sheet sits above the Gym Mode overlay", z_ok)
    page.keyboard.press("Escape")
    page.wait_for_timeout(150)
    check("M: Esc closes only the sheet — Gym Mode stays open", page.locator("#gymOverlay.active").count() == 1 and page.locator("#altSheet").get_attribute("hidden") is not None)
    page.click("#gymBody .alt-btn")
    page.wait_for_selector("#altSheet:not([hidden]) .alt-body")
    gpick = page.locator(".alt-item-close .alt-pick").first
    gid = gpick.get_attribute("data-id")
    gpick.click()
    page.wait_for_selector(".alt-confirm")
    page.click('[data-action="alt-confirm"]')
    page.wait_for_selector("#altSheet", state="hidden")
    gym_title_after = page.inner_text("#gymBody .gym-ex-title").strip()
    check("M: Gym Mode shows the replacement at set 1", gym_title_after != gym_title_before and "سيت 1 من 4" in page.inner_text("#gymBody .gym-ex-sub"), gym_title_after)
    check("M: Gym Mode marks it as a replacement", page.locator("#gymBody .swap-note").count() == 1)
    page.click('[data-action="gym-exit"]')
    page.wait_for_timeout(200)
    check("M: page underneath shows the same replacement", page.locator(f"#card-{SLOT} .badge-swap").count() == 1 and page.inner_text(f"#card-{SLOT} .ex-titles .en").strip() == gym_title_after)

    # ---------- N. dashboard + program still render with a replacement active ----------
    page.goto(BASE + "#dashboard")
    page.wait_for_selector(".dash-cta, .dash-stat-card")
    check("N: dashboard renders with an active replacement", True)
    page.goto(BASE + "#program")
    page.wait_for_selector(".program-day-card")
    check("N: program page renders", page.locator(".program-day-card").count() >= 3)

    # ---------- O. library: browse mode ----------
    page.goto(BASE + "#exercises")
    page.wait_for_selector("#exerciseListContainer .ex-card")
    page.fill("#exerciseSearch", "Chest Dip")
    page.wait_for_timeout(300)
    page.click("#exerciseListContainer .ex-head")
    page.wait_for_timeout(250)
    page.click("#exerciseListContainer .alt-btn")
    page.wait_for_selector("#altSheet:not([hidden]) .alt-body")
    check("O: library sheet is browse-only (no replace buttons)", page.locator(".alt-pick").count() == 0 and "افتح التمرين من صفحة يوم التمرين" in page.inner_text("#altPanel .alt-body"))
    check("O: partial-only exercise explains why there is no like-for-like swap", "مفيش بديل مطابق" in page.inner_text("#altPanel .alt-body") and "الديبس" in page.inner_text("#altPanel .alt-body"))
    check("O: partial options still listed below", page.locator(".alt-item-partial").count() > 0)
    page.keyboard.press("Escape")
    page.wait_for_selector("#altSheet", state="hidden")

    # ---------- P. profile with no equipment: default shows everything + hint ----------
    ctx2 = browser.new_context(viewport={"width": 390, "height": 800})
    st2 = json.loads(json.dumps(SEED_STATE))
    del st2["data"]["profile"]
    ctx2.add_init_script("if(!localStorage.getItem('__s2')){localStorage.setItem('gymGuide.state',%s);localStorage.setItem('__s2','1');}" % json.dumps(json.dumps(st2)))
    p2 = ctx2.new_page()
    e2 = []
    p2.on("pageerror", lambda e: e2.append(str(e)))
    p2.goto(BASE + "#dayPushA")
    p2.wait_for_selector(f"#card-{SLOT}")
    open_card_alt(p2, 0)
    check("P: without a saved profile nothing is hidden and a hint links to the profile", p2.locator(".alt-toggle").count() == 0 and p2.locator('.alt-hint a[href="#profile"]').count() == 1 and "مخفي لأنه محتاج معدات" not in p2.inner_text("#altPanel .alt-body"))
    p2.click('.alt-hint a[href="#profile"]')
    p2.wait_for_timeout(300)
    check("P: following the profile link closes the sheet and navigates", p2.locator("#altSheet").get_attribute("hidden") is not None and p2.url.endswith("#profile"))
    ctx2.close()

    # ---------- Q. desktop width ----------
    ctx3 = browser.new_context(viewport={"width": 1100, "height": 800})
    ctx3.add_init_script(SEED)
    p3 = ctx3.new_page()
    p3.goto(BASE + "#dayPushA")
    p3.wait_for_selector(f"#card-{SLOT}")
    open_card_alt(p3, 0)
    box = p3.locator("#altPanel").bounding_box()
    check("Q: desktop sheet is centred and capped at 640px", box["width"] <= 641 and abs((box["x"] + box["width"] / 2) - 550) < 4, str(box))
    shot(p3, "03-sheet-desktop")
    ctx3.close()

    # ---------- R. service worker + whole-run health ----------
    sw = open(os.path.join(ROOT, "service-worker.js"), encoding="utf-8").read()
    check("R: new modules precached, cache version bumped", all(f"./js/modules/{m}" in sw for m in ("exercise-alternatives.js", "replacements.js", "alternatives-ui.js")) and "gym-guide-shell-v1.16.0" in sw)
    check("R: html still rtl", page.evaluate("document.documentElement.dir") == "rtl")
    check("R: no page/console errors during the whole run", not errors, "; ".join(errors[:3]))
    check("R: no failed HTTP responses", not bad, "; ".join(bad[:3]))
    browser.close()

httpd.shutdown()
if failed:
    print(f"FAIL: {len(failed)} failed, {passed} passed")
    for f in failed:
        print("  ✗", f)
    sys.exit(1)
print(f"OK: {passed}/{passed} browser checks passed")
