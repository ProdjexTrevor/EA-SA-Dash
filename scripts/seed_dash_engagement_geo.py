#!/usr/bin/env python3
"""
Create/seed Dash_EngagementGeo only (never touches non-Dash tables).

Synthetic geocoding + population density for Health Map. Coordinates are
deterministic jitter around country anchors so points spread evenly on the map.
"""
from __future__ import annotations

import hashlib
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT.parent / "scripts"))
from country_data_common import connect

# country -> (lat, lon, default people/km2, urban people/km2 for urban keywords)
COUNTRY_ANCHORS: dict[str, tuple[float, float, float, float]] = {
    "Burundi": (-3.37, 29.36, 470.0, 1200.0),
    "Congo, Dem. Rep.": (-2.88, 28.0, 40.0, 450.0),
    "Kenya": (0.52, 37.45, 95.0, 1800.0),
    "Malawi": (-13.25, 34.30, 200.0, 900.0),
    "Mozambique": (-18.67, 35.53, 40.0, 700.0),
    "Rwanda": (-1.94, 29.87, 530.0, 1400.0),
    "South Sudan": (6.88, 31.31, 20.0, 400.0),
    "Sudan": (15.50, 32.53, 25.0, 600.0),
    "Tanzania": (-6.37, 34.89, 70.0, 1200.0),
    "Uganda": (1.37, 32.29, 230.0, 1500.0),
    # Southern Africa
    # Malawi / Mozambique already above
    # The Moon (demo — Indian Ocean offset cluster)
    "Mare Serenitatis": (-8.5, 72.0, 5.0, 40.0),
    "Mare Tranquillitatis": (-10.0, 74.5, 4.0, 35.0),
    "Oceanus Procellarum": (-12.0, 70.0, 3.0, 30.0),
}

# Fallback region anchors
REGION_ANCHORS = {
    "East Africa": (0.0, 35.0, 80.0, 900.0),
    "Southern Africa": (-15.0, 32.0, 50.0, 700.0),
    "The Moon": (-10.0, 72.0, 4.0, 30.0),
}


def stable_jitter(key: str, index: int, n: int) -> tuple[float, float]:
    """Even quasi-grid offset around a country centroid (degrees ≈ miles/69)."""
    h = hashlib.sha256(f"{key}:{index}".encode()).hexdigest()
    u = int(h[:8], 16) / 0xFFFFFFFF
    v = int(h[8:16], 16) / 0xFFFFFFFF
    # Golden-angle spiral for even packing among n points
    golden = math.pi * (3 - math.sqrt(5))
    r = math.sqrt((index + 0.5) / max(n, 1)) * 2.8  # up to ~2.8° ≈ 190 mi
    theta = index * golden + u * 0.4
    dlat = r * math.cos(theta) + (v - 0.5) * 0.15
    dlon = r * math.sin(theta) + (u - 0.5) * 0.15
    return dlat, dlon


def is_urban(name: str) -> bool:
    n = (name or "").lower()
    return any(k in n for k in ("urban", "city", "bunjubura", "nairobi", "kampala", "dar"))


def ensure_table(cur) -> None:
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS Dash_EngagementGeo (
          engagement_id INT NOT NULL PRIMARY KEY,
          engagement_name VARCHAR(256) NULL,
          country VARCHAR(100) NULL,
          region VARCHAR(100) NULL,
          latitude DECIMAL(10, 7) NOT NULL,
          longitude DECIMAL(10, 7) NOT NULL,
          locality VARCHAR(150) NULL,
          population_local INT NULL,
          pop_density_per_km2 DECIMAL(12, 2) NOT NULL,
          urban_rural VARCHAR(20) NULL,
          geocode_source VARCHAR(50) NOT NULL DEFAULT 'seeded',
          is_demo TINYINT(1) NOT NULL DEFAULT 0,
          notes TEXT NULL,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """
    )


def main() -> None:
    cn = connect()
    cur = cn.cursor()
    ensure_table(cur)
    cn.commit()

    # Latest-quarter distinct engagements from Dash_all_data only
    cur.execute(
        """
        SELECT engagement_id, engagment_name AS name, country, region
        FROM Dash_all_data
        WHERE engagement_id IS NOT NULL
          AND date = (SELECT MAX(date) FROM Dash_all_data)
        GROUP BY engagement_id, engagment_name, country, region
        ORDER BY region, country, engagement_id
        """
    )
    rows = cur.fetchall()
    if not rows:
        print("No Dash_all_data engagements found.")
        cn.close()
        return

    # Count per country for even spacing
    by_country: dict[str, list] = {}
    for r in rows:
        by_country.setdefault(r["country"] or "Unknown", []).append(r)

    cur.execute("DELETE FROM Dash_EngagementGeo")
    inserted = 0

    for country, group in by_country.items():
        n = len(group)
        for i, r in enumerate(group):
            eid = int(r["engagement_id"])
            name = r["name"] or f"Engagement {eid}"
            region = r["region"] or ""
            anchor = COUNTRY_ANCHORS.get(country) or REGION_ANCHORS.get(region) or (0.0, 30.0, 50.0, 500.0)
            base_lat, base_lon, rural_d, urban_d = anchor
            dlat, dlon = stable_jitter(f"{country}:{eid}", i, n)
            # keep mild clustering for large DRC set
            scale = 1.15 if n > 20 else 1.0
            lat = base_lat + dlat * scale
            lon = base_lon + dlon * scale
            urban = is_urban(name)
            density = urban_d if urban else rural_d
            # slight per-row density jitter
            h = int(hashlib.sha256(str(eid).encode()).hexdigest()[:4], 16)
            density *= 0.85 + (h % 100) / 250.0
            pop_local = int(density * 80 * (1.2 if urban else 0.6))
            is_demo = 1 if region == "The Moon" or "Mare" in (country or "") or "Oceanus" in (country or "") else 0
            locality = name.split("-")[-1].strip() if "-" in name else name
            notes = (
                "Synthetic geocode for Health Map (Dash_EngagementGeo only). "
                "Not surveyed field coordinates."
            )
            if is_demo:
                notes += " Demo region: The Moon cluster (Indian Ocean map placement)."

            cur.execute(
                """
                INSERT INTO Dash_EngagementGeo (
                  engagement_id, engagement_name, country, region,
                  latitude, longitude, locality, population_local,
                  pop_density_per_km2, urban_rural, geocode_source, is_demo, notes
                ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'seeded',%s,%s)
                """,
                (
                    eid,
                    name[:256],
                    country,
                    region,
                    round(lat, 7),
                    round(lon, 7),
                    locality[:150],
                    pop_local,
                    round(density, 2),
                    "urban" if urban else "rural",
                    is_demo,
                    notes,
                ),
            )
            inserted += 1

    cn.commit()
    cur.execute("SELECT COUNT(*) c FROM Dash_EngagementGeo")
    print(f"Dash_EngagementGeo seeded: {inserted} rows (total {cur.fetchone()['c']})")
    cur.execute(
        "SELECT region, COUNT(*) c FROM Dash_EngagementGeo GROUP BY region ORDER BY region"
    )
    for r in cur.fetchall():
        print(f"  {r['region']}: {r['c']}")
    cn.close()


if __name__ == "__main__":
    main()
