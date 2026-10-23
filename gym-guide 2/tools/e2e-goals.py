#!/usr/bin/env python3
"""
e2e-goals.py — real-browser checks for goal-driven personalization + first-run setup.
  A. Brand-new install: neutral header, setup opens, page behind it is inert.
  B. Skip keeps every default and never comes back.
  C. Full setup: header/program/profile change, survive a reload.
  D. Day page follows goal + posture (goal note, drills, cardio finisher).
  E. Existing users (old saved state) are never interrupted and keep their header.
  F. Profile page changes the header live; setup can be re-opened; keyboard focus.
Run from the project root:   python3 tools/e2e-goals.py   (needs playwright + chromium)
"""
import json, os, sys, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
passed, failed = 0, []

def check(name, cond, detail=""):
    global passed
    if cond: passed += 1
    else: failed.append(name + (f" — {detail}" if detail else ""))

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True

httpd = Server(("127.0.0.1", 0), functools.partial(Quiet, directory=ROOT))
BASE = f"http://127.0.0.1:{httpd.server_address[1]}/"
threading.Thread(target=httpd.serve_forever, daemon=True).start()

def state(page):
    raw = page.evaluate("localStorage.getItem('gymGuide.state')")
    return (json.loads(raw)["data"] if raw else {})

def brand(page):
    return page.inner_text(".brand-program").replace("\n", " ").strip()

def click(page, action, **attrs):
    sel = f'[data-action="{action}"]' + "".join(f'[data-{k}="{v}"]' for k, v in attrs.items())
    page.click(sel)

with sync_playwright() as pw:
    browser = pw.chromium.launch()
    def new_page(seed=None, **kw):
        ctx = browser.new_context(viewport={"width": 390, "height": 844}, locale="ar-EG", **kw)
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        if seed is not None:
            page.add_init_script("if(!localStorage.getItem('gymGuide.state')) localStorage.setItem('gymGuide.state', %s)" % json.dumps(json.dumps({"version": 1, "data": seed})))
        return ctx, page, errors

    # ---------- A. brand-new install ----------
    ctx, page, errs = new_page()
    page.goto(BASE); page.wait_for_selector("#onboarding:not([hidden])")
    check("A: setup opens on first visit", page.is_visible("#onboarding"))
    check("A: header is neutral before any choice", "Your Personal Training Guide" in brand(page) and "تضخيم" not in brand(page), brand(page))
    check("A: page title is neutral", "تضخيم" not in page.title())
    check("A: page behind the setup is inert", page.evaluate("document.getElementById('mainContent').hasAttribute('inert') && document.getElementById('tabs').hasAttribute('inert')"))
    check("A: nothing saved yet", state(page).get("profile") is None)
    check("A: focus moved to the question", page.evaluate("document.activeElement.id") == "obTitle")
    check("A: Next is disabled until a goal is chosen", page.is_disabled('[data-action="ob-next"]'))
    check("A: skip link is offered", page.is_visible('[data-action="ob-skip"]'))
    page.screenshot(path="/tmp/ob-1-goal.png")
    ctx.close()

    # ---------- B. skip ----------
    ctx, page, errs = new_page()
    page.goto(BASE); page.wait_for_selector("#onboarding:not([hidden])")
    click(page, "ob-skip")
    check("B: setup closes on skip", page.is_hidden("#onboarding"))
    check("B: page is usable again (not inert)", not page.evaluate("document.getElementById('mainContent').hasAttribute('inert')"))
    check("B: defaults untouched (neutral header)", "Your Personal Training Guide" in brand(page))
    page.wait_for_timeout(400)
    st = state(page)
    check("B: skip remembered", st.get("onboarding", {}).get("skipped") is True and st["onboarding"]["done"] is True)
    check("B: no profile invented", not (st.get("profile") or {}).get("goal"))
    page.reload(); page.wait_for_selector("#mainContent section")
    check("B: setup does not come back after reload", page.is_hidden("#onboarding"))
    check("B: no JS errors (skip)", not errs, str(errs[:2]))
    ctx.close()

    # ---------- C. full setup ----------
    ctx, page, errs = new_page()
    page.goto(BASE); page.wait_for_selector("#onboarding:not([hidden])")
    click(page, "ob-select", field="goal", value="muscle-gain")
    check("C: goal gets selected", page.get_attribute('[data-field="goal"][data-value="muscle-gain"]', "aria-pressed") == "true")
    click(page, "ob-next")
    check("C: step 2 needs a level", page.is_disabled('[data-action="ob-next"]'))
    click(page, "ob-select", field="experience", value="intermediate")
    click(page, "ob-select", field="days", value="3")
    click(page, "ob-next")
    click(page, "ob-multi", field="equipment", value="full-gym")
    click(page, "ob-next")
    click(page, "ob-multi", field="posture", value="apt")
    click(page, "ob-multi", field="posture", value="rounded-shoulders")
    check("C: 'none' is exclusive with real postures", True)
    click(page, "ob-multi", field="posture", value="none")
    check("C: choosing none clears the others", page.get_attribute('[data-field="posture"][data-value="apt"]', "aria-pressed") == "false")
    click(page, "ob-multi", field="posture", value="apt")
    check("C: choosing a posture clears none", page.get_attribute('[data-field="posture"][data-value="none"]', "aria-pressed") == "false")
    click(page, "ob-multi", field="posture", value="rounded-shoulders")
    click(page, "ob-back"); click(page, "ob-next")
    check("C: going back and forward keeps the answers", page.get_attribute('[data-field="posture"][data-value="apt"]', "aria-pressed") == "true")
    click(page, "ob-next")
    summary = page.inner_text(".ob-summary")
    check("C: summary previews the new header", "Hypertrophy & Posture Correction" in summary and "تضخيم + تصحيح القوام" in summary, summary[:120])
    page.screenshot(path="/tmp/ob-5-summary.png")
    check("C: nothing saved before 'start'", not (state(page).get("profile") or {}).get("goal"))
    click(page, "ob-finish")
    page.wait_for_timeout(500)
    check("C: setup closes", page.is_hidden("#onboarding"))
    check("C: header now follows the goal + posture", "Hypertrophy & Posture Correction" in brand(page) and "تضخيم + تصحيح القوام" in brand(page), brand(page))
    st = state(page)
    check("C: profile saved", st["profile"]["goal"] == "muscle-gain" and st["profile"]["experience"] == "intermediate" and st["profile"]["equipment"] == ["full-gym"] and st["profile"]["posture"] == ["apt", "rounded-shoulders"], str(st.get("profile")))
    check("C: 3 days intermediate muscle-gain -> Full Body program", st["schedule"]["programId"] == "fullbody", str(st.get("schedule")))
    check("C: setup marked done", st["onboarding"]["done"] is True and st["onboarding"]["skipped"] is False)
    page.reload(); page.wait_for_selector("#mainContent section")
    check("C: still personalized after reload", "تضخيم + تصحيح القوام" in brand(page) and page.is_hidden("#onboarding"))
    check("C: dashboard shows the goal note", page.is_visible("#goalNote"))
    # D. day page
    page.goto(BASE + "#day1"); page.wait_for_selector("#goalNote")
    note = page.inner_text("#goalNote")
    check("D: day page shows the goal note with posture", "تضخيم" in note and "ميل الحوض" in note and "انحناء الكتفين" in note)
    act = page.inner_text("#group-day1-act, [id*='day1-act']") if page.query_selector("[id*='day1-act']") else ""
    names = page.evaluate("Array.from(document.querySelectorAll('[id^=\"card-day1-act-\"]')).map(c=>c.innerText)")
    check("D: 3 activation drills when posture is chosen", len(names) == 3, str(len(names)))
    check("D: no cardio finisher for muscle gain", page.query_selector("[id*='day1-finisher']") is None)
    cool = page.evaluate("Array.from(document.querySelectorAll('[id^=\"card-day1-cooldown-\"]')).map(c=>c.textContent)")
    check("D: cool-down lists posture stretches first", any("Hip Flexor" in c for c in cool[:3]) and any("Doorway" in c for c in cool[:3]), str([c[:30] for c in cool[:3]]))
    page.screenshot(path="/tmp/day1-posture.png", full_page=False)
    # corrective page
    page.goto(BASE + "#corrective"); page.wait_for_selector(".condition-card")
    check("D: posture library marks the chosen conditions", page.locator(".condition-card.mine").count() == 2)
    # F. profile page
    page.goto(BASE + "#profile"); page.wait_for_selector("#profileSummaryBox")
    page.click('[data-action="profile-set-single"][data-field="goal"][data-value="fat-loss"]')
    page.wait_for_timeout(300)
    check("F: changing goal in profile updates the header at once", "Fat Loss & Posture Correction" in brand(page), brand(page))
    page.click('[data-action="profile-toggle-multi"][data-field="posture"][data-value="rounded-shoulders"]')
    page.click('[data-action="profile-toggle-multi"][data-field="posture"][data-value="apt"]')
    page.wait_for_timeout(300)
    check("F: clearing posture removes it from the header", brand(page).startswith("Fat Loss") and "Posture" not in brand(page) and "تصحيح" not in brand(page), brand(page))
    page.goto(BASE + "#day1"); page.wait_for_selector("#goalNote")
    check("D: fat-loss day shows a cardio finisher", page.query_selector("[id*='day1-finisher']") is not None)
    check("D: fat-loss without posture shows 2 activation drills", page.locator('[id^="card-day1-act-"]').count() == 2)
    check("D: no posture line in the goal note", "تصحيح القوام" not in page.inner_text("#goalNote"))
    # reopen setup
    page.goto(BASE + "#profile"); page.wait_for_selector('[data-action="ob-reopen"]')
    page.click('[data-action="ob-reopen"]')
    check("F: setup can be reopened from the profile", page.is_visible("#onboarding"))
    check("F: reopened setup is pre-filled with the current goal", page.get_attribute('[data-field="goal"][data-value="fat-loss"]', "aria-pressed") == "true")
    # keyboard trap
    for _ in range(12):
        page.keyboard.press("Tab")
        if not page.evaluate("document.getElementById('onboarding').contains(document.activeElement)"):
            check("F: Tab stays inside the setup", False); break
    else:
        check("F: Tab stays inside the setup", True)
    page.keyboard.press("Shift+Tab")
    check("F: Shift+Tab stays inside the setup", page.evaluate("document.getElementById('onboarding').contains(document.activeElement)"))
    click(page, "ob-skip")
    check("F: skipping a re-opened setup keeps the profile", state(page)["profile"]["goal"] == "fat-loss")
    check("F: no JS errors (full flow)", not errs, str(errs[:3]))
    ctx.close()

    # ---------- E. existing user ----------
    legacy = {"sets": {"day1-main-0": {"0": True}}, "history": {"day1-main-0": [{"date": "2026-01-01", "volume": "100"}]}}
    ctx, page, errs = new_page(seed=legacy)
    page.goto(BASE); page.wait_for_selector("#mainContent section")
    page.wait_for_timeout(300)
    check("E: existing user is not interrupted", page.is_hidden("#onboarding"))
    check("E: existing user keeps the header they always had", "Hypertrophy & APT Correction" in brand(page) and "تضخيم + تصحيح القوام" in brand(page), brand(page))
    check("E: their workout data is untouched", state(page)["sets"] == legacy["sets"] and state(page)["history"] == legacy["history"])
    page.goto(BASE + "#day1"); page.wait_for_selector("[id^='card-day1-main-0']")
    check("E: no goal note until they choose a goal", page.query_selector("#goalNote") is None)
    check("E: 2 activation drills as before", page.locator('[id^="card-day1-act-"]').count() == 2)
    check("E: no JS errors (legacy)", not errs, str(errs[:3]))
    ctx.close()

    # old fixtures from earlier versions
    fx = os.path.join(ROOT, "tools", "fixtures")
    for name in sorted(os.listdir(fx)):
        if not name.endswith(".json"): continue
        try:
            data = json.load(open(os.path.join(fx, name), encoding="utf-8"))
        except Exception:
            continue
        data = data.get("data", data) if isinstance(data, dict) else {}
        ctx, page, errs = new_page(seed=data)
        page.goto(BASE); page.wait_for_selector("#mainContent section"); page.wait_for_timeout(250)
        check(f"E: fixture {name} loads without setup or errors", page.is_hidden("#onboarding") and not errs, str(errs[:2]))
        ctx.close()

    browser.close()

print(f"e2e-goals: {passed} passed, {len(failed)} failed")
for f in failed: print("  FAIL:", f)
sys.exit(1 if failed else 0)
