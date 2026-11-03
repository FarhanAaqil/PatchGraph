"""Synchronize and polish frontend UI/UX pages with Stitch Obsidian Nexus design."""
from __future__ import annotations

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
PREVIEW_FILE = REPO_ROOT / "frontend" / "standalone_preview.html"
PAGES_DIR = REPO_ROOT / "frontend" / "pages"

def polish_ui() -> None:
    content = PREVIEW_FILE.read_text(encoding="utf-8")

    # 1. Clean title if needed
    content = content.replace("PatchGraph \ufffd", "PatchGraph \u2014")

    # 2. Add id to telemetry table section
    if 'id="telemetry-table-section"' not in content:
        content = content.replace(
            "<!-- Telemetry Data Grid -->",
            "<!-- Telemetry Data Grid -->\n<div id=\"telemetry-table-section\">",
            1
        )
        content = content.replace(
            "</table>\n</div>",
            "</table>\n</div>\n</div>",
            1
        )

    # 3. Enhance switchTab function
    enhanced_script = """
    function switchTab(tabIndex) {
      // 1. Hide all panels and reset buttons/navs
      for (let i = 1; i <= 4; i++) {
        const panel = document.getElementById('tab-panel-' + i);
        const btn = document.getElementById('btn-tab-' + i);
        const nav = document.getElementById('sidebar-nav-' + i);
        if (panel) {
          panel.classList.add('hidden');
          panel.classList.remove('block');
        }
        if (btn) {
          btn.className = "px-3.5 py-1.5 rounded-lg text-body-sm font-body-sm text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all flex items-center gap-2";
        }
        if (nav) {
          nav.className = "text-on-surface-variant px-space-md py-space-xs rounded-lg hover:text-on-surface hover:bg-surface-container flex items-center gap-2.5 transition-colors cursor-pointer";
        }
      }

      // 2. Show active panel and set active styles
      const targetPanel = document.getElementById('tab-panel-' + tabIndex);
      const targetBtn = document.getElementById('btn-tab-' + tabIndex);
      const targetNav = document.getElementById('sidebar-nav-' + tabIndex);
      if (targetPanel) {
        targetPanel.classList.remove('hidden');
        targetPanel.classList.add('block');
      }
      if (targetBtn) {
        targetBtn.className = "px-3.5 py-1.5 rounded-lg text-body-sm font-body-sm font-medium transition-all flex items-center gap-2 bg-surface-container-high text-primary border border-primary/20 shadow-sm";
      }
      if (targetNav) {
        targetNav.className = "text-primary font-medium bg-surface-container-high border-l-2 border-primary px-space-md py-space-xs rounded-r-lg flex items-center gap-2.5 transition-colors cursor-pointer";
      }
    }

    // Auto-select tab from query param if provided
    window.addEventListener('DOMContentLoaded', () => {
      const urlParams = new URLSearchParams(window.location.search);
      const tab = urlParams.get('tab');
      if (tab) {
        const num = parseInt(tab, 10);
        if (num >= 1 && num <= 4) switchTab(num);
      }
    });
"""
    # Replace the existing switchTab implementation
    content = re.sub(
        r'function switchTab\(tabIndex\) \{[\s\S]*?targetBtn\.className = [^\n]+;\s*\}',
        enhanced_script.strip(),
        content
    )

    # 4. Update sidebar links
    old_nav_pattern = r'<nav class="space-y-1">[\s\S]*?</nav>'
    new_nav = """<nav class="space-y-1">
<a id="sidebar-nav-1" class="text-primary font-medium bg-surface-container-high border-l-2 border-primary px-space-md py-space-xs rounded-r-lg flex items-center gap-2.5 transition-colors cursor-pointer" href="/pages/dependency-graph" onclick="switchTab(1); return false;">
<span class="material-symbols-outlined text-[16px]">hub</span>
<span class="text-body-sm font-body-sm">Supply-Chain Topology</span>
</a>
<a id="sidebar-nav-telemetry" class="text-on-surface-variant px-space-md py-space-xs rounded-lg hover:text-on-surface hover:bg-surface-container flex items-center gap-2.5 transition-colors cursor-pointer" href="/pages/assets" onclick="switchTab(1); const el = document.getElementById('telemetry-table-section'); if(el) { el.scrollIntoView({behavior: 'smooth'}); } return false;">
<span class="material-symbols-outlined text-[16px]">shield_with_heart</span>
<span class="text-body-sm font-body-sm">Vulnerability Telemetry</span>
</a>
<a id="sidebar-nav-2" class="text-on-surface-variant px-space-md py-space-xs rounded-lg hover:text-on-surface hover:bg-surface-container flex items-center gap-2.5 transition-colors cursor-pointer" href="/pages/dashboard?tab=2" onclick="switchTab(2); return false;">
<span class="material-symbols-outlined text-[16px]">memory</span>
<span class="text-body-sm font-body-sm">CP-SAT Solver Engine</span>
</a>
<a id="sidebar-nav-3" class="text-on-surface-variant px-space-md py-space-xs rounded-lg hover:text-on-surface hover:bg-surface-container flex items-center gap-2.5 transition-colors cursor-pointer" href="/pages/data-health" onclick="switchTab(3); return false;">
<span class="material-symbols-outlined text-[16px]">tune</span>
<span class="text-body-sm font-body-sm">Constraint Policies</span>
</a>
<a id="sidebar-nav-4" class="text-on-surface-variant px-space-md py-space-xs rounded-lg hover:text-on-surface hover:bg-surface-container flex items-center gap-2.5 transition-colors cursor-pointer" href="/pages/audit" onclick="switchTab(4); return false;">
<span class="material-symbols-outlined text-[16px]">verified</span>
<span class="text-body-sm font-body-sm">Cryptographic Ledger</span>
</a>
<a class="text-on-surface-variant px-space-md py-space-xs rounded-lg hover:text-on-surface hover:bg-surface-container flex items-center gap-2.5 transition-colors cursor-pointer" href="#" onclick="alert('Platform Settings: All 26 Database Tables Healthy. RBAC Enforcement Active (Lead SecOps: Farhan Aaqil).'); return false;">
<span class="material-symbols-outlined text-[16px]">settings</span>
<span class="text-body-sm font-body-sm">Platform Settings</span>
</a>
</nav>"""

    content = re.sub(old_nav_pattern, new_nav, content, count=1)

    # Write back enhanced standalone_preview.html
    PREVIEW_FILE.write_text(content, encoding="utf-8")
    print(f"Updated {PREVIEW_FILE} ({len(content)} chars)")

    # 5. Synchronize all pages in frontend/pages/
    page_tab_map = {
        "dashboard.html": 1,
        "dependency-graph.html": 1,
        "blast-radius.html": 1,
        "assets.html": 1,
        "data-health.html": 3,
        "audit.html": 4,
    }

    PAGES_DIR.mkdir(parents=True, exist_ok=True)
    for filename, initial_tab in page_tab_map.items():
        page_content = content
        # Inject initial tab switch on load for this specific page
        page_script = f"""
    <script>
      window.addEventListener('DOMContentLoaded', () => {{
        switchTab({initial_tab});
      }});
    </script>
</body>"""
        page_content = page_content.replace("</body>", page_script)
        dest = PAGES_DIR / filename
        dest.write_text(page_content, encoding="utf-8")
        print(f"Generated {dest} (Initial Tab {initial_tab})")

if __name__ == "__main__":
    polish_ui()
