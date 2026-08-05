"""Generate regional management scorecard CSV from all_data."""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen

OUT = Path(__file__).resolve().parent.parent.parent / "reports" / "management_scorecard"
API = "http://localhost:3010/api/data-health/scorecard"


def main() -> int:
    try:
        with urlopen(API, timeout=60) as r:
            report = json.loads(r.read().decode())
    except Exception as ex:
        print(f"Start the dashboard API first (npm run dev). Error: {ex}", file=sys.stderr)
        return 1

    OUT.mkdir(parents=True, exist_ok=True)
    q = report["quarter_end"]
    csv_url = f"http://localhost:3010/api/data-health/scorecard.csv?date={q}"
    with urlopen(csv_url, timeout=60) as r:
        csv_body = r.read().decode("utf-8-sig")

    csv_path = OUT / f"regional_scorecard_{q}.csv"
    csv_path.write_text(csv_body, encoding="utf-8-sig")

    md_lines = [
        f"# Regional Data Health Scorecard — {q}",
        "",
        f"Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
        "",
        f"**Global average score:** {report['global_overall_score']}",
        "",
        "## Scoring dimensions",
        "",
        "| Dimension | Weight | What it measures |",
        "|-----------|--------|------------------|",
        "| Integrity | 30% | Valid engagement IDs, no duplicates |",
        "| Completeness | 25% | MBB % and calculated fields filled |",
        "| Consistency | 25% | GEN, baptisms, and DBS align logically |",
        "| Movement | 20% | GEN reported where churches exist |",
        "",
        "## Regional results",
        "",
        "| Region | Score | Grade | Status | Integrity | Complete | Consistent | Movement |",
        "|--------|------:||:-----:|--------|----------:|---------:|-----------:|---------:|",
    ]
    for r in report["regions"]:
        md_lines.append(
            f"| {r['region']} | {r['overall_score']} | {r['grade']} | {r['status']} "
            f"| {r['integrity_score']} | {r['completeness_score']} | {r['consistency_score']} | {r['movement_score']} |"
        )

    md_lines.extend(["", "## Manager notes by region", ""])
    for r in report["regions"]:
        md_lines.append(f"### {r['region']} ({r['grade']} — {r['overall_score']})")
        md_lines.append(r["manager_note"])
        md_lines.append("")

    md_path = OUT / f"regional_scorecard_{q}.md"
    md_path.write_text("\n".join(md_lines), encoding="utf-8")

    print(f"Wrote {csv_path}")
    print(f"Wrote {md_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
