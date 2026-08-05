#!/usr/bin/env python3
"""
Seed Dash_AdminBoundaries (geoBoundaries ADM1–ADM4 simplified when available) and
Dash_PlaceLabels (Natural Earth major places for EA/SA countries).

ONLY writes Dash_* tables. Attribution: geoBoundaries (CC BY 4.0), Natural Earth.

Usage:
  python scripts/seed_dash_map_layers.py              # admin 1–4 + places
  python scripts/seed_dash_map_layers.py --levels 3,4  # village tiers only
  python scripts/seed_dash_map_layers.py --admin-only
  python scripts/seed_dash_map_layers.py --places-only
"""
from __future__ import annotations

import argparse
import json
import ssl
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT.parent / "scripts"))
from country_data_common import connect

UA = "EA-SA-Dash-seed/1.0 (Health Map; attribution: geoBoundaries CC-BY + Natural Earth)"
FETCH_TIMEOUT = 180

# ISO3 / country name for Dash regions
COUNTRIES: list[tuple[str, str, str]] = [
    ("BDI", "Burundi", "East Africa"),
    ("COD", "Congo, Dem. Rep.", "East Africa"),
    ("KEN", "Kenya", "East Africa"),
    ("MWI", "Malawi", "East Africa"),
    ("MOZ", "Mozambique", "East Africa"),
    ("RWA", "Rwanda", "East Africa"),
    ("SSD", "South Sudan", "East Africa"),
    ("SDN", "Sudan", "East Africa"),
    ("TZA", "Tanzania", "East Africa"),
    ("UGA", "Uganda", "East Africa"),
    # Malawi + Mozambique also SA in some rows — region tag for map filter only
]

ISO2_FROM_ISO3 = {
    "BDI": "BI",
    "COD": "CD",
    "KEN": "KE",
    "MWI": "MW",
    "MOZ": "MZ",
    "RWA": "RW",
    "SSD": "SS",
    "SDN": "SD",
    "TZA": "TZ",
    "UGA": "UG",
}

NE_PLACES_URL = (
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/"
    "master/geojson/ne_10m_populated_places_simple.geojson"
)

CTX = ssl.create_default_context()


def fetch_json(url: str) -> Any:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=FETCH_TIMEOUT, context=CTX) as resp:
        return json.loads(resp.read().decode("utf-8"))


def feature_name(props: dict) -> str:
    for k in (
        "shapeName",
        "shapeName_en",
        "name",
        "NAME",
        "NAME_1",
        "NAME_2",
        "NAME_3",
        "NAME_4",
        "ADM1_EN",
        "ADM2_EN",
        "ADM3_EN",
        "ADM4_EN",
        "admin1Name",
        "admin2Name",
        "admin3Name",
        "admin4Name",
    ):
        v = props.get(k)
        if v:
            return str(v)[:200]
    return "Unknown"


def feature_id(props: dict, fallback: str) -> str:
    for k in (
        "shapeID",
        "shapeGroup",
        "GID_1",
        "GID_2",
        "GID_3",
        "GID_4",
        "ADM1_PCODE",
        "ADM2_PCODE",
        "ADM3_PCODE",
        "ADM4_PCODE",
        "HASC_1",
        "HASC_2",
        "HASC_3",
        "HASC_4",
    ):
        v = props.get(k)
        if v:
            return str(v)[:100]
    return fallback[:100]


def centroid_of_geom(geom: dict) -> tuple[float | None, float | None]:
    """Rough centroid from exterior coordinates (good enough for labels)."""
    try:
        gtype = geom.get("type")
        coords = geom.get("coordinates")
        if not coords:
            return None, None
        pts: list[tuple[float, float]] = []

        def walk(c: Any) -> None:
            if not isinstance(c, (list, tuple)):
                return
            if len(c) >= 2 and isinstance(c[0], (int, float)) and isinstance(c[1], (int, float)):
                pts.append((float(c[0]), float(c[1])))
                return
            for x in c:
                walk(x)

        walk(coords)
        if not pts:
            return None, None
        # sample for speed on huge rings
        step = max(1, len(pts) // 200)
        sample = pts[::step]
        lon = sum(p[0] for p in sample) / len(sample)
        lat = sum(p[1] for p in sample) / len(sample)
        return lat, lon
    except Exception:
        return None, None


def ensure_tables(cur) -> None:
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS Dash_AdminBoundaries (
          id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          country_iso CHAR(3) NOT NULL,
          country_name VARCHAR(100) NOT NULL,
          region VARCHAR(50) NULL,
          adm_level TINYINT NOT NULL,
          shape_name VARCHAR(200) NOT NULL,
          shape_id VARCHAR(100) NULL,
          geometry_json MEDIUMTEXT NOT NULL,
          centroid_lat DECIMAL(10, 7) NULL,
          centroid_lon DECIMAL(10, 7) NULL,
          source VARCHAR(80) NOT NULL DEFAULT 'geoBoundaries',
          license_note VARCHAR(200) NULL,
          is_demo TINYINT(1) NOT NULL DEFAULT 0,
          KEY idx_adm_level (adm_level),
          KEY idx_iso (country_iso),
          KEY idx_centroid (centroid_lat, centroid_lon)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS Dash_PlaceLabels (
          id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(150) NOT NULL,
          place_class VARCHAR(40) NULL,
          country_iso CHAR(3) NULL,
          country_iso2 CHAR(2) NULL,
          country_name VARCHAR(100) NULL,
          latitude DECIMAL(10, 7) NOT NULL,
          longitude DECIMAL(10, 7) NOT NULL,
          population INT NULL,
          source VARCHAR(80) NOT NULL DEFAULT 'NaturalEarth',
          is_demo TINYINT(1) NOT NULL DEFAULT 0,
          KEY idx_iso (country_iso),
          KEY idx_ll (latitude, longitude)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """
    )


def seed_admin(cur, levels: tuple[int, ...] = (1, 2, 3, 4)) -> int:
    """Replace only the requested adm_level rows (safe partial re-seed)."""
    for level in levels:
        cur.execute("DELETE FROM Dash_AdminBoundaries WHERE adm_level = %s", (level,))
    total = 0
    for iso, cname, region in COUNTRIES:
        for level in levels:
            adm = f"ADM{level}"
            print(f"  Fetching {iso} {adm}…")
            try:
                meta = fetch_json(f"https://www.geoboundaries.org/api/current/gbOpen/{iso}/{adm}")
                url = meta.get("simplifiedGeometryGeoJSON")
                if not url:
                    print(f"    skip {iso} {adm}: no simplified URL")
                    continue
                fc = fetch_json(url)
            except urllib.error.HTTPError as e:
                if e.code == 404:
                    print(f"    skip {iso} {adm}: not published")
                else:
                    print(f"    ERROR {iso} {adm}: HTTP {e.code}")
                continue
            except Exception as e:
                print(f"    ERROR {iso} {adm}: {e}")
                continue
            feats = fc.get("features") or []
            for i, feat in enumerate(feats):
                props = feat.get("properties") or {}
                geom = feat.get("geometry")
                if not geom:
                    continue
                name = feature_name(props)
                sid = feature_id(props, f"{iso}-{adm}-{i}")
                lat, lon = centroid_of_geom(geom)
                cur.execute(
                    """
                    INSERT INTO Dash_AdminBoundaries (
                      country_iso, country_name, region, adm_level,
                      shape_name, shape_id, geometry_json,
                      centroid_lat, centroid_lon, source, license_note, is_demo
                    ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,'geoBoundaries',%s,0)
                    """,
                    (
                        iso,
                        cname,
                        region,
                        level,
                        name,
                        sid,
                        json.dumps(geom, separators=(",", ":")),
                        lat,
                        lon,
                        "CC BY 4.0 geoBoundaries (wmgeolab)",
                    ),
                )
                total += 1
            print(f"    {iso} {adm}: {len(feats)} features")
    return total


def seed_places(cur) -> int:
    cur.execute("DELETE FROM Dash_PlaceLabels")
    iso2s = set(ISO2_FROM_ISO3.values())
    iso3_by_iso2 = {v: k for k, v in ISO2_FROM_ISO3.items()}
    name_by_iso3 = {iso: n for iso, n, _ in COUNTRIES}

    print("  Fetching Natural Earth populated places…")
    try:
        fc = fetch_json(NE_PLACES_URL)
    except Exception as e:
        print(f"  Natural Earth failed ({e}); seeding capital fallbacks only.")
        return seed_place_fallbacks(cur)

    total = 0
    for feat in fc.get("features") or []:
        props = feat.get("properties") or {}
        geom = feat.get("geometry") or {}
        coords = geom.get("coordinates") or []
        if len(coords) < 2:
            continue
        lon, lat = float(coords[0]), float(coords[1])
        # filter roughly to East / Southern Africa box first
        if not (-27 <= lat <= 23 and 20 <= lon <= 52):
            continue
        iso2 = (
            props.get("iso_a2")
            or props.get("ISO_A2")
            or props.get("adm0_a3")  # sometimes wrong key
            or ""
        )
        iso2 = str(iso2).upper()
        if iso2 not in iso2s:
            # try adm0 name match
            continue
        name = props.get("name") or props.get("NAME") or props.get("nameascii")
        if not name:
            continue
        pop = props.get("pop_max") or props.get("POP_MAX") or props.get("pop_min")
        try:
            pop_i = int(pop) if pop is not None else None
        except Exception:
            pop_i = None
        # Keep larger places so labels stay usable
        if pop_i is not None and pop_i < 15000:
            continue
        pclass = props.get("featurecla") or props.get("FEATURECLA") or "Populated place"
        iso3 = iso3_by_iso2.get(iso2)
        cur.execute(
            """
            INSERT INTO Dash_PlaceLabels (
              name, place_class, country_iso, country_iso2, country_name,
              latitude, longitude, population, source, is_demo
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,'NaturalEarth',0)
            """,
            (
                str(name)[:150],
                str(pclass)[:40],
                iso3,
                iso2,
                name_by_iso3.get(iso3 or "", None),
                lat,
                lon,
                pop_i,
            ),
        )
        total += 1
    if total == 0:
        return seed_place_fallbacks(cur)
    return total


def seed_place_fallbacks(cur) -> int:
    capitals = [
        ("Bujumbura", "BI", "BDI", "Burundi", -3.3822, 29.3644, 497166),
        ("Nairobi", "KE", "KEN", "Kenya", -1.2921, 36.8219, 4397073),
        ("Kampala", "UG", "UGA", "Uganda", 0.3476, 32.5825, 1680600),
        ("Dodoma", "TZ", "TZA", "Tanzania", -6.1630, 35.7516, 410956),
        ("Dar es Salaam", "TZ", "TZA", "Tanzania", -6.7924, 39.2083, 4364541),
        ("Kigali", "RW", "RWA", "Rwanda", -1.9441, 30.0619, 1132686),
        ("Juba", "SS", "SSD", "South Sudan", 4.8594, 31.5713, 525953),
        ("Khartoum", "SD", "SDN", "Sudan", 15.5007, 32.5599, 1974647),
        ("Lilongwe", "MW", "MWI", "Malawi", -13.9626, 33.7741, 989318),
        ("Maputo", "MZ", "MOZ", "Mozambique", -25.9692, 32.5732, 1088800),
        ("Kinshasa", "CD", "COD", "Congo, Dem. Rep.", -4.4419, 15.2663, 14500000),
        ("Goma", "CD", "COD", "Congo, Dem. Rep.", -1.6792, 29.2228, 670000),
        ("Bukavu", "CD", "COD", "Congo, Dem. Rep.", -2.4908, 28.8428, 870000),
        ("Mombasa", "KE", "KEN", "Kenya", -4.0435, 39.6682, 1208333),
        ("Kisumu", "KE", "KEN", "Kenya", -0.0917, 34.7680, 397957),
        ("Mbarara", "UG", "UGA", "Uganda", -0.6072, 30.6545, 195160),
        ("Arusha", "TZ", "TZA", "Tanzania", -3.3869, 36.6830, 416442),
        ("Blantyre", "MW", "MWI", "Malawi", -15.7861, 35.0058, 800264),
        ("Beira", "MZ", "MOZ", "Mozambique", -19.8333, 34.8500, 530604),
        ("Nampula", "MZ", "MOZ", "Mozambique", -15.1165, 39.2666, 743125),
    ]
    n = 0
    for name, iso2, iso3, cname, lat, lon, pop in capitals:
        cur.execute(
            """
            INSERT INTO Dash_PlaceLabels (
              name, place_class, country_iso, country_iso2, country_name,
              latitude, longitude, population, source, is_demo
            ) VALUES (%s,'Admin-0 capital',%s,%s,%s,%s,%s,%s,'fallback_capitals',0)
            """,
            (name, iso3, iso2, cname, lat, lon, pop),
        )
        n += 1
    return n


def parse_levels(s: str) -> tuple[int, ...]:
    parts = []
    for p in s.split(","):
        p = p.strip()
        if not p:
            continue
        n = int(p)
        if n < 1 or n > 4:
            raise SystemExit(f"Invalid adm level {n}; use 1–4")
        parts.append(n)
    if not parts:
        raise SystemExit("No adm levels specified")
    return tuple(sorted(set(parts)))


def main() -> None:
    ap = argparse.ArgumentParser(description="Seed Dash map layers (admin polys + places)")
    ap.add_argument(
        "--levels",
        default="1,2,3,4",
        help="Comma-separated geoBoundaries levels to re-seed (default 1,2,3,4)",
    )
    ap.add_argument("--admin-only", action="store_true", help="Skip place labels")
    ap.add_argument("--places-only", action="store_true", help="Skip admin boundaries")
    args = ap.parse_args()
    levels = parse_levels(args.levels)

    cn = connect()
    cur = cn.cursor()
    print("Creating Dash_AdminBoundaries + Dash_PlaceLabels…")
    ensure_tables(cur)
    cn.commit()

    if not args.places_only:
        print(f"Seeding admin boundaries (geoBoundaries simplified ADM{list(levels)})…")
        n_adm = seed_admin(cur, levels=levels)
        cn.commit()
        print(f"  Admin features written: {n_adm}")

    if not args.admin_only:
        print("Seeding place labels…")
        n_pl = seed_places(cur)
        cn.commit()
        print(f"  Places: {n_pl}")

    cur.execute(
        "SELECT adm_level, COUNT(*) c FROM Dash_AdminBoundaries GROUP BY adm_level ORDER BY adm_level"
    )
    for r in cur.fetchall():
        print(f"  ADM{r['adm_level']}: {r['c']}")
    cur.execute("SELECT COUNT(*) c FROM Dash_PlaceLabels")
    print(f"  Places total: {cur.fetchone()['c']}")
    cn.close()
    print("Done (Dash_* only).")


if __name__ == "__main__":
    main()
