from pathlib import Path
import csv
import pymysql
from test_mysql_connection import load_env

OUT = Path(r"c:\Repos\New Gen Data\reports\management_scorecard\mbb_totals_last_quarter.csv")
OUT_BY_REGION = Path(r"c:\Repos\New Gen Data\reports\management_scorecard\mbb_totals_last_quarter_by_region.csv")

raw = load_env(Path(r"c:\Repos\New Gen Data\.env"))
kw = dict(
    host=raw["MYSQL_HOST"].strip(),
    port=int(raw.get("MYSQL_PORT") or 3306),
    user=raw["MYSQL_USER"].strip(),
    password=raw["MYSQL_PASSWORD"].strip(),
    database=raw["MYSQL_DATABASE"].strip(),
    connect_timeout=30,
    cursorclass=pymysql.cursors.DictCursor,
)
if raw.get("MYSQL_SSL", "").lower() in ("1", "true", "yes", "required"):
    kw["ssl"] = {"ssl_verify_cert": False, "ssl_verify_identity": False}

conn = pymysql.connect(**kw)
cur = conn.cursor()
cur.execute("SELECT MAX(`date`) AS latest FROM all_data WHERE `date` IS NOT NULL")
latest_dt = cur.fetchone()["latest"]
latest = str(latest_dt)[:10]

cur.execute(
    """
    SELECT
      `date` AS quarter_end,
      YEAR(`date`) AS year,
      QUARTER(`date`) AS quarter,
      COUNT(*) AS engagement_rows,
      SUM(COALESCE(mbb_disciples_calc, 0)) AS total_mbb_disciples_calc,
      SUM(COALESCE(CAST(NULLIF(TRIM(mbb_churches_calc), '') AS SIGNED), 0)) AS total_mbb_churches_calc,
      SUM(COALESCE(new_disciples, 0)) AS total_new_disciples,
      SUM(COALESCE(total_church, 0)) AS total_churches
    FROM all_data WHERE `date` = %s
    """,
    (latest_dt,),
)
global_row = cur.fetchone()
global_row["quarter_end"] = str(global_row["quarter_end"])

cur.execute(
    """
    SELECT
      region,
      COUNT(*) AS engagement_rows,
      SUM(COALESCE(mbb_disciples_calc, 0)) AS total_mbb_disciples_calc,
      SUM(COALESCE(CAST(NULLIF(TRIM(mbb_churches_calc), '') AS SIGNED), 0)) AS total_mbb_churches_calc,
      SUM(COALESCE(new_disciples, 0)) AS total_new_disciples,
      SUM(COALESCE(total_church, 0)) AS total_churches
    FROM all_data WHERE `date` = %s
    GROUP BY region
    ORDER BY total_mbb_disciples_calc DESC
    """,
    (latest_dt,),
)
regions = cur.fetchall()
conn.close()

OUT.parent.mkdir(parents=True, exist_ok=True)

with OUT.open("w", newline="", encoding="utf-8-sig") as f:
    w = csv.DictWriter(
        f,
        fieldnames=[
            "quarter_end",
            "year",
            "quarter",
            "scope",
            "engagement_rows",
            "total_mbb_disciples_calc",
            "total_mbb_churches_calc",
            "total_new_disciples",
            "total_churches",
        ],
    )
    w.writeheader()
    w.writerow({**global_row, "scope": "ALL REGIONS"})

with OUT_BY_REGION.open("w", newline="", encoding="utf-8-sig") as f:
    w = csv.DictWriter(
        f,
        fieldnames=[
            "quarter_end",
            "year",
            "quarter",
            "region",
            "engagement_rows",
            "total_mbb_disciples_calc",
            "total_mbb_churches_calc",
            "total_new_disciples",
            "total_churches",
        ],
    )
    w.writeheader()
    for r in regions:
        w.writerow(
            {
                "quarter_end": latest,
                "year": global_row["year"],
                "quarter": global_row["quarter"],
                **r,
            }
        )

# Combined single file with global + regional rows
COMBINED = Path(r"c:\Repos\New Gen Data\reports\management_scorecard\mbb_totals_last_quarter_combined.csv")
with COMBINED.open("w", newline="", encoding="utf-8-sig") as f:
    w = csv.DictWriter(
        f,
        fieldnames=[
            "quarter_end",
            "year",
            "quarter",
            "region",
            "engagement_rows",
            "total_mbb_disciples_calc",
            "total_mbb_churches_calc",
            "total_new_disciples",
            "total_churches",
        ],
    )
    w.writeheader()
    w.writerow(
        {
            "quarter_end": global_row["quarter_end"],
            "year": global_row["year"],
            "quarter": global_row["quarter"],
            "region": "ALL REGIONS",
            "engagement_rows": global_row["engagement_rows"],
            "total_mbb_disciples_calc": global_row["total_mbb_disciples_calc"],
            "total_mbb_churches_calc": global_row["total_mbb_churches_calc"],
            "total_new_disciples": global_row["total_new_disciples"],
            "total_churches": global_row["total_churches"],
        }
    )
    for r in regions:
        w.writerow(
            {
                "quarter_end": latest,
                "year": global_row["year"],
                "quarter": global_row["quarter"],
                "region": r["region"],
                "engagement_rows": r["engagement_rows"],
                "total_mbb_disciples_calc": r["total_mbb_disciples_calc"],
                "total_mbb_churches_calc": r["total_mbb_churches_calc"],
                "total_new_disciples": r["total_new_disciples"],
                "total_churches": r["total_churches"],
            }
        )

print(f"Wrote {COMBINED}")
print(f"Wrote {OUT}")
print(f"Wrote {OUT_BY_REGION}")
