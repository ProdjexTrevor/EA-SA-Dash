#!/usr/bin/env python3
"""Create Dash_* tables in newgendata and seed EA, SA, The Moon."""
from __future__ import annotations

import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
# Prefer EA-SA-Dash sibling "New Gen Data" scripts helper; fall back to same-folder scripts
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT.parent / "scripts"))
from country_data_common import connect

REGIONS_REAL = ("East Africa", "Southern Africa")
MOON_REGION = "The Moon"
MOON_REGION_ID = 900
# Engagement IDs 90001+ for Moon
MOON_ENG_START = 90001


def q_ends(start_year: int = 2018, end: date | None = None) -> list[date]:
    end = end or date(2026, 3, 31)
    out: list[date] = []
    y, m = start_year, 3
    while True:
        d = date(y, m, 31 if m != 6 and m != 9 else 30)
        if m == 6:
            d = date(y, 6, 30)
        elif m == 9:
            d = date(y, 9, 30)
        elif m == 12:
            d = date(y, 12, 31)
        else:
            d = date(y, 3, 31)
        if d > end:
            break
        out.append(d)
        if m == 12:
            y += 1
            m = 3
        else:
            m += 3
    return out


DDL = [
    """
    CREATE TABLE IF NOT EXISTS Dash_Regions (
      region_id INT NOT NULL PRIMARY KEY,
      region_name VARCHAR(50) NOT NULL,
      population_size INT NULL,
      urban_pct INT NULL,
      unreached_status TEXT NULL,
      rural_pct INT NULL,
      cultural_challenges TEXT NULL,
      engagement_id INT NULL,
      is_demo TINYINT(1) NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,
    """
    CREATE TABLE IF NOT EXISTS Dash_Countries (
      country_id INT NOT NULL PRIMARY KEY,
      country_name VARCHAR(100) NOT NULL,
      population_size INT NULL,
      urban_pct INT NULL,
      rural_pct INT NULL,
      unreached_status VARCHAR(100) NULL,
      cultural_challenges TEXT NULL,
      region_id INT NULL,
      is_demo TINYINT(1) NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,
    """
    CREATE TABLE IF NOT EXISTS Dash_PartnerOrg (
      partnerorg_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      partner_organizations_Name VARCHAR(100) NULL,
      contact_name VARCHAR(100) NULL,
      phone VARCHAR(50) NULL,
      email VARCHAR(50) NULL,
      address VARCHAR(50) NULL,
      region_name VARCHAR(100) NULL,
      is_demo TINYINT(1) NOT NULL DEFAULT 1
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,
    """
    CREATE TABLE IF NOT EXISTS Dash_Engagements (
      engagement_id INT NOT NULL PRIMARY KEY,
      engagement_name VARCHAR(256) NULL,
      partner_org_id INT NULL,
      region_id INT NULL,
      country_id INT NULL,
      state VARCHAR(50) NULL,
      county VARCHAR(50) NULL,
      city_town_village VARCHAR(50) NULL,
      affinity_group TEXT NULL,
      language VARCHAR(50) NULL,
      religious_background VARCHAR(50) NULL,
      urban_rural VARCHAR(50) NULL,
      people_group_id INT NULL,
      start_date DATE NULL,
      evangelism_method_id INT NULL,
      population_size INT NULL,
      E2M_stage VARCHAR(50) NULL,
      E2M_level INT NULL,
      Active VARCHAR(255) NULL,
      People_Group VARCHAR(255) NULL,
      Region_Name VARCHAR(255) NULL,
      is_demo TINYINT(1) NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,
    """
    CREATE TABLE IF NOT EXISTS Dash_PeopleGroups (
      people_group_id INT NOT NULL PRIMARY KEY,
      people_group_name VARCHAR(50) NOT NULL,
      population_size INT NULL,
      urban_rural VARCHAR(25) NULL,
      unreached_status VARCHAR(50) NULL,
      cultural_challenges TEXT NULL,
      engagement_id INT NULL,
      is_demo TINYINT(1) NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,
    """
    CREATE TABLE IF NOT EXISTS Dash_Leaders (
      leader_id INT NOT NULL PRIMARY KEY,
      leader_name VARCHAR(50) NOT NULL,
      leader_contact VARCHAR(50) NULL,
      engagement_id INT NULL,
      is_demo TINYINT(1) NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,
    """
    CREATE TABLE IF NOT EXISTS Dash_Disciples (
      disciple_id INT NOT NULL PRIMARY KEY,
      disciple_name VARCHAR(25) NOT NULL,
      leader_id INT NULL,
      generation INT NULL,
      num_disciples_made INT NULL,
      engagement_id INT NULL,
      is_demo TINYINT(1) NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,
    """
    CREATE TABLE IF NOT EXISTS Dash_all_data (
      ng_key INT NOT NULL PRIMARY KEY,
      date DATE NULL,
      region_id INT NULL,
      region VARCHAR(255) NULL,
      REGION_OLD VARCHAR(255) NULL,
      engagement_id INT NULL,
      COUNTRY_OLD VARCHAR(255) NULL,
      country VARCHAR(255) NULL,
      country_id INT NULL,
      engagment_name VARCHAR(255) NULL,
      people_group_id VARCHAR(255) NULL,
      people_group VARCHAR(255) NULL,
      dbs INT NULL,
      com_church INT NULL,
      cat_church INT NULL,
      total_church INT NULL,
      gen INT NULL,
      avg_church_size INT NULL,
      new_disciples INT NULL,
      new_baptisms INT NULL,
      mbb INT NULL,
      count_mbb INT NULL,
      other_christ_followers INT NULL,
      notes VARCHAR(255) NULL,
      leaders_in_training INT NULL,
      active_trainers_choaches INT NULL,
      number_of_trainings_held_qtr INT NULL,
      highest_level_of_training_held INT NULL,
      category_of_training_held VARCHAR(255) NULL,
      mbb_decimal INT NULL,
      mb_churches INT NULL,
      g_status VARCHAR(255) NULL,
      priority VARCHAR(255) NULL,
      lost_churches INT NULL,
      merged_churches INT NULL,
      stage_tag VARCHAR(255) NULL,
      level_tag VARCHAR(255) NULL,
      churches_to_date INT NULL,
      gen_to_date INT NULL,
      active INT NULL,
      mbb_disciples_calc INT NULL,
      mbb_churches_calc INT NULL,
      is_demo TINYINT(1) NOT NULL DEFAULT 0,
      KEY idx_dash_all_date (date),
      KEY idx_dash_all_region (region),
      KEY idx_dash_all_eng (engagement_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,
]


def create_tables(cur) -> None:
    for ddl in DDL:
        cur.execute(ddl)
    print("Dash_* tables created (or already exist)")


def truncate_all(cur) -> None:
    cur.execute("SET FOREIGN_KEY_CHECKS=0")
    for t in [
        "Dash_all_data",
        "Dash_Disciples",
        "Dash_Leaders",
        "Dash_PeopleGroups",
        "Dash_Engagements",
        "Dash_PartnerOrg",
        "Dash_Countries",
        "Dash_Regions",
    ]:
        cur.execute(f"TRUNCATE TABLE `{t}`")
    cur.execute("SET FOREIGN_KEY_CHECKS=1")
    print("Truncated Dash_* tables")


def seed_regions(cur) -> dict[str, int]:
    # copy real region rows when present
    cur.execute(
        """
        SELECT region_id, region_name, population_size, urban_pct, unreached_status,
               rural_pct, cultural_challenges, engagement_id
        FROM Regions
        WHERE region_name IN (%s, %s)
        """,
        REGIONS_REAL,
    )
    rows = cur.fetchall()
    id_by_name: dict[str, int] = {}
    for r in rows:
        id_by_name[r["region_name"]] = int(r["region_id"])
        cur.execute(
            """
            INSERT INTO Dash_Regions
            (region_id, region_name, population_size, urban_pct, unreached_status,
             rural_pct, cultural_challenges, engagement_id, is_demo)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,0)
            """,
            (
                r["region_id"],
                r["region_name"],
                r["population_size"],
                r["urban_pct"],
                r["unreached_status"],
                r["rural_pct"],
                r["cultural_challenges"],
                r["engagement_id"],
            ),
        )
    # ensure both regions even if master missing
    for name, fallback_id in [("East Africa", 5), ("Southern Africa", 8)]:
        if name not in id_by_name:
            # guess from all_data
            cur.execute(
                "SELECT region_id FROM all_data WHERE region=%s AND region_id IS NOT NULL LIMIT 1",
                (name,),
            )
            hit = cur.fetchone()
            rid = int(hit["region_id"]) if hit else fallback_id
            id_by_name[name] = rid
            cur.execute(
                """
                INSERT INTO Dash_Regions (region_id, region_name, is_demo)
                VALUES (%s,%s,0)
                ON DUPLICATE KEY UPDATE region_name=VALUES(region_name)
                """,
                (rid, name),
            )
    # Moon
    cur.execute(
        """
        INSERT INTO Dash_Regions
        (region_id, region_name, population_size, urban_pct, rural_pct,
         unreached_status, cultural_challenges, is_demo)
        VALUES (%s,%s,%s,%s,%s,%s,%s,1)
        ON DUPLICATE KEY UPDATE region_name=VALUES(region_name)
        """,
        (
            MOON_REGION_ID,
            MOON_REGION,
            12000,
            40,
            60,
            "Unreached (demo)",
            "Extreme isolation; vacuum of infrastructure; crater logistics",
        ),
    )
    id_by_name[MOON_REGION] = MOON_REGION_ID
    print("Regions:", id_by_name)
    return id_by_name


def seed_countries(cur, region_ids: dict[str, int]) -> None:
    # Countries that appear in EA/SA all_data
    cur.execute(
        """
        SELECT DISTINCT a.country_id, a.country
        FROM all_data a
        WHERE a.region IN (%s, %s) AND a.country_id IS NOT NULL
        """,
        REGIONS_REAL,
    )
    for r in cur.fetchall():
        cid, cname = r["country_id"], r["country"]
        cur.execute("SELECT * FROM Countries WHERE country_id=%s", (cid,))
        master = cur.fetchone()
        if master:
            cur.execute(
                """
                INSERT INTO Dash_Countries
                (country_id, country_name, population_size, urban_pct, rural_pct,
                 unreached_status, cultural_challenges, region_id, is_demo)
                VALUES (%s,%s,%s,%s,%s,%s,%s,NULL,0)
                ON DUPLICATE KEY UPDATE country_name=VALUES(country_name)
                """,
                (
                    master["country_id"],
                    master["country_name"],
                    master["population_size"],
                    master["urban_pct"],
                    master["rural_pct"],
                    master["unreached_status"],
                    master["cultural_challenges"],
                ),
            )
        else:
            cur.execute(
                """
                INSERT INTO Dash_Countries (country_id, country_name, is_demo)
                VALUES (%s,%s,0)
                ON DUPLICATE KEY UPDATE country_name=VALUES(country_name)
                """,
                (cid, cname or f"Country {cid}"),
            )

    # Moon countries
    moon_countries = [
        (901, "Mare Tranquillitatis", MOON_REGION_ID),
        (902, "Mare Serenitatis", MOON_REGION_ID),
        (903, "Oceanus Procellarum", MOON_REGION_ID),
    ]
    for cid, name, rid in moon_countries:
        cur.execute(
            """
            INSERT INTO Dash_Countries
            (country_id, country_name, population_size, urban_pct, rural_pct,
             unreached_status, cultural_challenges, region_id, is_demo)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,1)
            ON DUPLICATE KEY UPDATE country_name=VALUES(country_name)
            """,
            (
                cid,
                name,
                4000,
                30,
                70,
                "Unreached (demo)",
                "Low gravity culture; long communication lag",
                rid,
            ),
        )
    print("Countries seeded")


def seed_partner_orgs(cur) -> dict[str, int]:
    partners = [
        ("Lunar Frontier Partnership", "A. Armstrong", "partnerships@lunar.demo", MOON_REGION),
        ("Crater Care Coalition", "B. Aldrin", "care@crater.demo", MOON_REGION),
        ("Sea of Tranquility Fellowship", "C. Collins", "info@tranquility.demo", MOON_REGION),
        # also placeholder partners “for” EA/SA regions (no real partner data)
        ("East Africa Field Network (seed)", "Coordinator EA", "ea@partners.demo", "East Africa"),
        ("Southern Africa Partners (seed)", "Coordinator SA", "sa@partners.demo", "Southern Africa"),
    ]
    out: dict[str, int] = {}
    for name, contact, email, region in partners:
        cur.execute(
            """
            INSERT INTO Dash_PartnerOrg
            (partner_organizations_Name, contact_name, email, region_name, is_demo)
            VALUES (%s,%s,%s,%s,1)
            """,
            (name, contact, email, region),
        )
        out[name] = int(cur.lastrowid)
    print("Partner orgs:", out)
    return out


def seed_engagements_real(cur) -> set[int]:
    cur.execute(
        """
        SELECT DISTINCT engagement_id FROM all_data
        WHERE region IN (%s, %s) AND engagement_id IS NOT NULL
        """,
        REGIONS_REAL,
    )
    ids = [int(r["engagement_id"]) for r in cur.fetchall()]
    if not ids:
        print("No real engagements found")
        return set()

    # Prefer engagments_new, fall back Engagements
    placeholders = ",".join(["%s"] * len(ids))
    cur.execute(
        f"""
        SELECT engagement_id, engagement_name, partner_org_id, region_id, country_id,
               state, county, city_town_village, affinity_group, language,
               religious_background, urban_rural, people_group_id, start_date,
               evangelism_method_id, population_size, e2m_stage, e2m_level, active,
               people_group, region
        FROM engagments_new
        WHERE engagement_id IN ({placeholders})
        """,
        ids,
    )
    by_id = {int(r["engagement_id"]): r for r in cur.fetchall()}

    missing = [i for i in ids if i not in by_id]
    if missing:
        ph2 = ",".join(["%s"] * len(missing))
        cur.execute(
            f"""
            SELECT engagement_id, engagement_name, partner_org_id, region_id, country_id,
                   state, county, city_town_village, affinity_group, language,
                   religious_background, urban_rural, people_group_id, start_date,
                   evangelism_method_id, population_size, E2M_stage, E2M_level, Active,
                   People_Group, Region_Name
            FROM Engagements
            WHERE engagement_id IN ({ph2})
            """,
            missing,
        )
        for r in cur.fetchall():
            by_id[int(r["engagement_id"])] = {
                "engagement_id": r["engagement_id"],
                "engagement_name": r["engagement_name"],
                "partner_org_id": r["partner_org_id"],
                "region_id": r["region_id"],
                "country_id": r["country_id"],
                "state": r["state"],
                "county": r["county"],
                "city_town_village": r["city_town_village"],
                "affinity_group": r["affinity_group"],
                "language": r["language"],
                "religious_background": r["religious_background"],
                "urban_rural": r["urban_rural"],
                "people_group_id": r["people_group_id"],
                "start_date": r["start_date"],
                "evangelism_method_id": r["evangelism_method_id"],
                "population_size": r["population_size"],
                "e2m_stage": r.get("E2M_stage") or r.get("e2m_stage"),
                "e2m_level": r.get("E2M_level") or r.get("e2m_level"),
                "active": r.get("Active") or r.get("active"),
                "people_group": r.get("People_Group") or r.get("people_group"),
                "region": r.get("Region_Name") or r.get("region"),
            }

    # any still missing: stub from all_data
    for eid in ids:
        if eid in by_id:
            continue
        cur.execute(
            """
            SELECT engagement_id, MAX(engagment_name) n, MAX(region) reg,
                   MAX(region_id) rid, MAX(country_id) cid, MAX(country) c,
                   MAX(people_group) pg
            FROM all_data WHERE engagement_id=%s GROUP BY engagement_id
            """,
            (eid,),
        )
        r = cur.fetchone()
        if r:
            by_id[eid] = {
                "engagement_id": eid,
                "engagement_name": r["n"],
                "partner_org_id": None,
                "region_id": r["rid"],
                "country_id": r["cid"],
                "state": None,
                "county": None,
                "city_town_village": None,
                "affinity_group": None,
                "language": None,
                "religious_background": None,
                "urban_rural": None,
                "people_group_id": None,
                "start_date": None,
                "evangelism_method_id": None,
                "population_size": None,
                "e2m_stage": None,
                "e2m_level": None,
                "active": "1",
                "people_group": r["pg"],
                "region": r["reg"],
            }

    for eid, r in by_id.items():
        cur.execute(
            """
            INSERT INTO Dash_Engagements
            (engagement_id, engagement_name, partner_org_id, region_id, country_id,
             state, county, city_town_village, affinity_group, language,
             religious_background, urban_rural, people_group_id, start_date,
             evangelism_method_id, population_size, E2M_stage, E2M_level, Active,
             People_Group, Region_Name, is_demo)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,0)
            ON DUPLICATE KEY UPDATE engagement_name=VALUES(engagement_name)
            """,
            (
                eid,
                r.get("engagement_name"),
                r.get("partner_org_id"),
                r.get("region_id"),
                r.get("country_id"),
                r.get("state"),
                r.get("county"),
                r.get("city_town_village"),
                r.get("affinity_group"),
                r.get("language"),
                r.get("religious_background"),
                r.get("urban_rural"),
                r.get("people_group_id") if isinstance(r.get("people_group_id"), int) or (
                    str(r.get("people_group_id") or "").isdigit()
                )
                else None,
                r.get("start_date"),
                r.get("evangelism_method_id"),
                r.get("population_size"),
                r.get("e2m_stage"),
                r.get("e2m_level"),
                r.get("active"),
                r.get("people_group"),
                r.get("region"),
            ),
        )
    print(f"Real engagements: {len(by_id)}")
    return set(by_id.keys())


def seed_all_data_real(cur) -> int:
    cur.execute(
        """
        INSERT INTO Dash_all_data
        (ng_key, date, region_id, region, REGION_OLD, engagement_id, COUNTRY_OLD,
         country, country_id, engagment_name, people_group_id, people_group,
         dbs, com_church, cat_church, total_church, gen, avg_church_size,
         new_disciples, new_baptisms, mbb, count_mbb, other_christ_followers, notes,
         leaders_in_training, active_trainers_choaches, number_of_trainings_held_qtr,
         highest_level_of_training_held, category_of_training_held, mbb_decimal,
         mb_churches, g_status, priority, lost_churches, merged_churches, stage_tag,
         level_tag, churches_to_date, gen_to_date, active, mbb_disciples_calc,
         mbb_churches_calc, is_demo)
        SELECT
         ng_key, date, region_id, region, REGION_OLD, engagement_id, COUNTRY_OLD,
         country, country_id, engagment_name, people_group_id, people_group,
         dbs, com_church, cat_church, total_church, gen, avg_church_size,
         new_disciples, new_baptisms, mbb, count_mbb, other_christ_followers, notes,
         leaders_in_training, active_trainers_choaches, number_of_trainings_held_qtr,
         highest_level_of_training_held, category_of_training_held, mbb_decimal,
         mb_churches, g_status, priority, lost_churches, merged_churches, stage_tag,
         level_tag, churches_to_date, gen_to_date, active, mbb_disciples_calc,
         mbb_churches_calc, 0
        FROM all_data
        WHERE region IN (%s, %s)
        """,
        REGIONS_REAL,
    )
    n = cur.rowcount
    print(f"Copied all_data rows EA+SA: {n}")
    return n


def seed_people_leaders_disciples(cur, eng_ids: set[int]) -> None:
    if not eng_ids:
        return
    placeholders = ",".join(["%s"] * len(eng_ids))
    ids = list(eng_ids)

    cur.execute(
        f"""
        INSERT INTO Dash_PeopleGroups
        (people_group_id, people_group_name, population_size, urban_rural,
         unreached_status, cultural_challenges, engagement_id, is_demo)
        SELECT people_group_id, people_group_name, population_size, urban_rural,
               unreached_status, cultural_challenges, engagement_id, 0
        FROM PeopleGroups
        WHERE engagement_id IN ({placeholders})
        """,
        ids,
    )
    print("PeopleGroups copied:", cur.rowcount)

    cur.execute(
        f"""
        INSERT INTO Dash_Leaders (leader_id, leader_name, leader_contact, engagement_id, is_demo)
        SELECT leader_id, leader_name, leader_contact, engagement_id, 0
        FROM Leaders WHERE engagement_id IN ({placeholders})
        """,
        ids,
    )
    print("Leaders copied:", cur.rowcount)

    cur.execute(
        f"""
        INSERT INTO Dash_Disciples
        (disciple_id, disciple_name, leader_id, generation, num_disciples_made, engagement_id, is_demo)
        SELECT disciple_id, disciple_name, leader_id, generation, num_disciples_made, engagement_id, 0
        FROM Disciples WHERE engagement_id IN ({placeholders})
        """,
        ids,
    )
    print("Disciples copied:", cur.rowcount)


def seed_moon(cur, partners: dict[str, int]) -> None:
    # 9 engagements across 3 countries
    moon_engs = [
        (90001, "Moon-Tranquillitatis Lowlands", 901, "Lunar Settlers A", 9001),
        (90002, "Moon-Tranquillitatis Crater Edge", 901, "Lunar Settlers B", 9002),
        (90003, "Moon-Tranquillitatis Dome Colony", 901, "Dome Workers", 9003),
        (90004, "Moon-Serenitatis Ridge", 902, "Ridge Clan", 9004),
        (90005, "Moon-Serenitatis Valley", 902, "Valley Nomads", 9005),
        (90006, "Moon-Serenitatis Ice Miners", 902, "Ice Miners", 9006),
        (90007, "Moon-Procellarum Coast", 903, "Coastal Hab", 9007),
        (90008, "Moon-Procellarum Dark Basin", 903, "Basin Folk", 9008),
        (90009, "Moon-Procellarum Orbital Link", 903, "Link Crew", 9009),
    ]
    partner_ids = list(partners.values())[:3] or [None, None, None]

    for i, (eid, ename, cid, pg, pgid) in enumerate(moon_engs):
        pid = partner_ids[i % len(partner_ids)] if partner_ids else None
        cur.execute(
            """
            INSERT INTO Dash_Engagements
            (engagement_id, engagement_name, partner_org_id, region_id, country_id,
             people_group_id, People_Group, Region_Name, Active, urban_rural,
             population_size, language, religious_background, is_demo)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,'1','urban',%s,'Lunar','Traditional lunar (demo)',1)
            ON DUPLICATE KEY UPDATE engagement_name=VALUES(engagement_name)
            """,
            (
                eid,
                ename,
                pid,
                MOON_REGION_ID,
                cid,
                pgid,
                pg,
                MOON_REGION,
                800 + i * 50,
            ),
        )
        cur.execute(
            """
            INSERT INTO Dash_PeopleGroups
            (people_group_id, people_group_name, population_size, urban_rural,
             unreached_status, cultural_challenges, engagement_id, is_demo)
            VALUES (%s,%s,%s,'urban','Unreached (demo)',%s,%s,1)
            ON DUPLICATE KEY UPDATE people_group_name=VALUES(people_group_name)
            """,
            (
                pgid,
                pg,
                800 + i * 50,
                "Demo lunar cultural challenges",
                eid,
            ),
        )
        lid = 91000 + i
        cur.execute(
            """
            INSERT INTO Dash_Leaders (leader_id, leader_name, leader_contact, engagement_id, is_demo)
            VALUES (%s,%s,%s,%s,1)
            ON DUPLICATE KEY UPDATE leader_name=VALUES(leader_name)
            """,
            (lid, f"Leader {pg}", f"leader{i}@moon.demo", eid),
        )
        for d in range(3):
            did = 92000 + i * 10 + d
            cur.execute(
                """
                INSERT INTO Dash_Disciples
                (disciple_id, disciple_name, leader_id, generation, num_disciples_made, engagement_id, is_demo)
                VALUES (%s,%s,%s,%s,%s,%s,1)
                ON DUPLICATE KEY UPDATE disciple_name=VALUES(disciple_name)
                """,
                (did, f"D{i}-{d}", lid, d + 1, 2 + d, eid),
            )

    # Historical all_data for Moon
    dates = q_ends(2018, date(2026, 3, 31))
    ng_key = 9_000_000
    for q_i, d in enumerate(dates):
        growth = 1.0 + q_i * 0.08  # ramps over time
        for j, (eid, ename, cid, pg, pgid) in enumerate(moon_engs):
            # country name
            country = {
                901: "Mare Tranquillitatis",
                902: "Mare Serenitatis",
                903: "Oceanus Procellarum",
            }[cid]
            base_dbs = int((2 + j % 4) * growth)
            churches = int((1 + j % 3) * growth)
            disciples = int((8 + j * 3) * growth)
            baptisms = int(disciples * 0.35)
            leaders = max(1, int(growth))
            trainers = max(0, leaders - 1)
            mbb_d = int(disciples * 0.6)
            mbb_c = max(0, int(churches * 0.5))
            ng_key += 1
            cur.execute(
                """
                INSERT INTO Dash_all_data
                (ng_key, date, region_id, region, engagement_id, country, country_id,
                 engagment_name, people_group_id, people_group,
                 dbs, com_church, cat_church, total_church, gen, avg_church_size,
                 new_disciples, new_baptisms, mbb_decimal,
                 leaders_in_training, active_trainers_choaches,
                 mbb_disciples_calc, mbb_churches_calc, active, notes, is_demo)
                VALUES
                (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,
                 %s,%s,%s,%s,%s,%s,
                 %s,%s,%s,
                 %s,%s,
                 %s,%s,1,%s,1)
                """,
                (
                    ng_key,
                    d,
                    MOON_REGION_ID,
                    MOON_REGION,
                    eid,
                    country,
                    cid,
                    ename,
                    str(pgid),
                    pg,
                    base_dbs,
                    max(0, churches - 1),
                    1,
                    churches,
                    min(12, 2 + q_i // 4),
                    15,
                    disciples,
                    baptisms,
                    60,
                    leaders,
                    trainers,
                    mbb_d,
                    mbb_c,
                    "Demo seed — The Moon",
                ),
            )
    print(f"Moon historical quarters: {len(dates)}; engagements: {len(moon_engs)}")


def main() -> int:
    conn = connect()
    try:
        with conn.cursor() as cur:
            create_tables(cur)
            truncate_all(cur)
            region_ids = seed_regions(cur)
            seed_countries(cur, region_ids)
            partners = seed_partner_orgs(cur)
            eng_ids = seed_engagements_real(cur)
            seed_all_data_real(cur)
            seed_people_leaders_disciples(cur, eng_ids)
            seed_moon(cur, partners)

            cur.execute("SELECT region, COUNT(*) n FROM Dash_all_data GROUP BY region")
            print("Dash_all_data by region:", cur.fetchall())
            cur.execute("SELECT COUNT(*) n FROM Dash_Engagements")
            print("Dash_Engagements:", cur.fetchone())
            cur.execute("SELECT COUNT(*) n FROM Dash_PartnerOrg")
            print("Dash_PartnerOrg:", cur.fetchone())
        conn.commit()
        print("DONE — Dash_* tables seeded")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
