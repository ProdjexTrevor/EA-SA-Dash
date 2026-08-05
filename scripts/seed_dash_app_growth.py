#!/usr/bin/env python3
"""
Seed mock mobile-app growth telemetry into Dash_* tables only:

  Dash_AppUsers   – installs with lat/lon, personal invite_code, referral chain
  Dash_AppInvites – outbound invites (code + inviter + optional redeemer + geo)
  Dash_AppEvents  – sessions / opens / invites / content (geo-tagged)

Simulates viral spread across East Africa, Southern Africa, and The Moon demo
so the dashboard can show: where installs are, which invite codes are hot,
and how generational invite trees jump on the map.

Usage:
  python scripts/seed_dash_app_growth.py
  npm run seed:app-growth
"""
from __future__ import annotations

import hashlib
import math
import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT.parent / "scripts"))
from country_data_common import connect

# (city, country, region, lat, lon)
HUBS: list[tuple[str, str, str, float, float]] = [
    ("Nairobi", "Kenya", "East Africa", -1.2921, 36.8219),
    ("Kampala", "Uganda", "East Africa", 0.3476, 32.5825),
    ("Kigali", "Rwanda", "East Africa", -1.9441, 30.0619),
    ("Dar es Salaam", "Tanzania", "East Africa", -6.7924, 39.2083),
    ("Arusha", "Tanzania", "East Africa", -3.3869, 36.6830),
    ("Goma", "Congo, Dem. Rep.", "East Africa", -1.6792, 29.2228),
    ("Juba", "South Sudan", "East Africa", 4.8594, 31.5713),
    ("Khartoum", "Sudan", "East Africa", 15.5007, 32.5599),
    ("Lilongwe", "Malawi", "Southern Africa", -13.9626, 33.7741),
    ("Maputo", "Mozambique", "Southern Africa", -25.9692, 32.5732),
    ("Beira", "Mozambique", "Southern Africa", -19.8333, 34.8500),
    ("Bujumbura", "Burundi", "East Africa", -3.3614, 29.3599),
    # Moon demo cluster (same ocean offset used elsewhere)
    ("Crater Basin", "The Moon", "The Moon", -8.8, 72.4),
    ("South Ridge", "The Moon", "The Moon", -10.2, 74.1),
]

FIRST = ["Amina", "Juma", "Grace", "Daniel", "Ruth", "Peter", "Noor", "Lila", "Sam", "Isa", "Mei", "Omar", "Hana", "Yonas", "Tessa", "Kevin", "Wanjiru", "Okello", "Mwangi", "Fatima", "Imani", "Baraka", "Zawadi"]
LAST = ["Kamau", "Ochieng", "Niyonsaba", "Mugisha", "Diallo", "Mwangi", "Okello", "Hassan", "Abebe", "Chirwa", "Nhambiu", "Serenitatis", "Basin", "Ridge"]

PLATFORMS = ["android", "ios", "web"]
CHANNELS = ["whatsapp", "sms", "in_app", "link", "qr"]
EVENT_TYPES = ["open", "session_start", "content_view", "invite_sent", "invite_opened", "profile_edit"]


def h_int(s: str, n: int = 8) -> int:
    return int(hashlib.sha256(s.encode()).hexdigest()[:n], 16)


def invite_code(seed: str) -> str:
    """Short public share code (mock product style)."""
    raw = hashlib.sha256(seed.encode()).hexdigest()[:8].upper()
    return f"NG-{raw[:4]}-{raw[4:8]}"


def jitter(lat: float, lon: float, key: str, radius_deg: float = 0.35) -> tuple[float, float]:
    h = hashlib.sha256(key.encode()).hexdigest()
    u = int(h[:8], 16) / 0xFFFFFFFF
    v = int(h[8:16], 16) / 0xFFFFFFFF
    # polar jitter
    r = math.sqrt(u) * radius_deg
    th = v * 2 * math.pi
    return lat + r * math.cos(th), lon + r * math.sin(th)


def ensure_tables(cur) -> None:
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS Dash_AppUsers (
          user_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          display_name VARCHAR(100) NOT NULL,
          invite_code VARCHAR(24) NOT NULL,
          referred_by_code VARCHAR(24) NULL,
          referred_by_user_id INT NULL,
          generation INT NOT NULL DEFAULT 0,
          latitude DECIMAL(10, 7) NOT NULL,
          longitude DECIMAL(10, 7) NOT NULL,
          city VARCHAR(80) NULL,
          country VARCHAR(100) NULL,
          region VARCHAR(100) NULL,
          platform VARCHAR(20) NOT NULL DEFAULT 'android',
          installed_at DATETIME NOT NULL,
          last_active_at DATETIME NULL,
          session_count INT NOT NULL DEFAULT 0,
          is_seed TINYINT(1) NOT NULL DEFAULT 0,
          is_demo TINYINT(1) NOT NULL DEFAULT 1,
          UNIQUE KEY uq_invite_code (invite_code),
          KEY idx_ref (referred_by_user_id),
          KEY idx_region (region),
          KEY idx_ll (latitude, longitude),
          KEY idx_installed (installed_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS Dash_AppInvites (
          invite_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          invite_code VARCHAR(24) NOT NULL,
          inviter_user_id INT NOT NULL,
          invitee_user_id INT NULL,
          channel VARCHAR(40) NOT NULL DEFAULT 'link',
          status VARCHAR(20) NOT NULL DEFAULT 'sent',
          created_at DATETIME NOT NULL,
          opened_at DATETIME NULL,
          redeemed_at DATETIME NULL,
          latitude_sent DECIMAL(10, 7) NULL,
          longitude_sent DECIMAL(10, 7) NULL,
          latitude_redeemed DECIMAL(10, 7) NULL,
          longitude_redeemed DECIMAL(10, 7) NULL,
          is_demo TINYINT(1) NOT NULL DEFAULT 1,
          KEY idx_code (invite_code),
          KEY idx_inviter (inviter_user_id),
          KEY idx_invitee (invitee_user_id),
          KEY idx_status (status),
          KEY idx_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS Dash_AppEvents (
          event_id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          event_type VARCHAR(40) NOT NULL,
          event_at DATETIME NOT NULL,
          latitude DECIMAL(10, 7) NULL,
          longitude DECIMAL(10, 7) NULL,
          invite_code VARCHAR(24) NULL,
          meta_note VARCHAR(200) NULL,
          is_demo TINYINT(1) NOT NULL DEFAULT 1,
          KEY idx_user (user_id),
          KEY idx_type (event_type),
          KEY idx_at (event_at),
          KEY idx_code (invite_code)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """
    )


def seed(rng: random.Random) -> tuple[int, int, int]:
    cn = connect()
    cur = cn.cursor()
    ensure_tables(cur)
    cur.execute("DELETE FROM Dash_AppEvents")
    cur.execute("DELETE FROM Dash_AppInvites")
    cur.execute("DELETE FROM Dash_AppUsers")
    cn.commit()

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    # Grow over ~120 days so the film/timeline story has length
    start = now - timedelta(days=120)

    users: list[dict] = []
    # Seed pioneers (G0) — one+ per hub
    for i, (city, country, region, lat, lon) in enumerate(HUBS):
        la, lo = jitter(lat, lon, f"seed-{i}", 0.08)
        name = f"{FIRST[i % len(FIRST)]} {LAST[i % len(LAST)]}"
        code = invite_code(f"seed:{i}:{city}")
        installed = start + timedelta(days=i * 2 + rng.randint(0, 2), hours=rng.randint(8, 20))
        users.append(
            {
                "display_name": name,
                "invite_code": code,
                "referred_by_code": None,
                "referred_by_user_id": None,
                "generation": 0,
                "latitude": round(la, 6),
                "longitude": round(lo, 6),
                "city": city,
                "country": country,
                "region": region,
                "platform": PLATFORMS[i % 3],
                "installed_at": installed,
                "last_active_at": installed + timedelta(days=rng.randint(1, 30)),
                "session_count": rng.randint(8, 40),
                "is_seed": 1,
            }
        )

    # Viral growth: each generation recruits 1–3 users, sometimes new city nearby
    target_users = 280
    gen = 0
    while len(users) < target_users and gen < 8:
        parents = [u for u in users if u["generation"] == gen]
        if not parents:
            break
        for p_idx, parent in enumerate(parents):
            if len(users) >= target_users:
                break
            n_kids = 1 if gen > 4 else rng.randint(1, 3)
            for k in range(n_kids):
                if len(users) >= target_users:
                    break
                # 70% same hub jitter, 30% jump to random hub (geo spread story)
                if rng.random() < 0.7:
                    base_lat, base_lon = parent["latitude"], parent["longitude"]
                    city, country, region = parent["city"], parent["country"], parent["region"]
                else:
                    city, country, region, base_lat, base_lon = rng.choice(HUBS)
                la, lo = jitter(float(base_lat), float(base_lon), f"{parent['invite_code']}-k{k}-{len(users)}", 0.4)
                uid_placeholder = len(users)
                name = f"{rng.choice(FIRST)} {rng.choice(LAST)}"
                code = invite_code(f"u:{uid_placeholder}:{parent['invite_code']}")
                days_after = max(1, int((now - parent["installed_at"]).days * 0.15) + rng.randint(1, 14))
                installed = parent["installed_at"] + timedelta(days=days_after, hours=rng.randint(7, 22))
                if installed > now:
                    installed = now - timedelta(hours=rng.randint(1, 48))
                users.append(
                    {
                        "display_name": name,
                        "invite_code": code,
                        "referred_by_code": parent["invite_code"],
                        "referred_by_user_id": None,  # fill after insert
                        "parent_idx": users.index(parent),
                        "generation": gen + 1,
                        "latitude": round(la, 6),
                        "longitude": round(lo, 6),
                        "city": city,
                        "country": country,
                        "region": region,
                        "platform": rng.choice(PLATFORMS),
                        "installed_at": installed,
                        "last_active_at": installed + timedelta(days=rng.randint(0, 20)),
                        "session_count": rng.randint(1, 35),
                        "is_seed": 0,
                    }
                )
        gen += 1

    # Insert users
    id_by_idx: list[int] = []
    for u in users:
        cur.execute(
            """
            INSERT INTO Dash_AppUsers (
              display_name, invite_code, referred_by_code, referred_by_user_id, generation,
              latitude, longitude, city, country, region, platform,
              installed_at, last_active_at, session_count, is_seed, is_demo
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,1)
            """,
            (
                u["display_name"],
                u["invite_code"],
                u["referred_by_code"],
                None,
                u["generation"],
                u["latitude"],
                u["longitude"],
                u["city"],
                u["country"],
                u["region"],
                u["platform"],
                u["installed_at"],
                u["last_active_at"],
                u["session_count"],
                u["is_seed"],
            ),
        )
        id_by_idx.append(cur.lastrowid)

    # Backfill referred_by_user_id
    for i, u in enumerate(users):
        pidx = u.get("parent_idx")
        if pidx is None:
            continue
        cur.execute(
            "UPDATE Dash_AppUsers SET referred_by_user_id = %s WHERE user_id = %s",
            (id_by_idx[pidx], id_by_idx[i]),
        )

    cn.commit()

    # Invites: successful (redeemed = child) + pending sent
    invite_n = 0
    for i, u in enumerate(users):
        pidx = u.get("parent_idx")
        if pidx is None:
            continue
        parent = users[pidx]
        inviter_id = id_by_idx[pidx]
        invitee_id = id_by_idx[i]
        created = u["installed_at"] - timedelta(hours=rng.randint(2, 72))
        channel = rng.choice(CHANNELS)
        cur.execute(
            """
            INSERT INTO Dash_AppInvites (
              invite_code, inviter_user_id, invitee_user_id, channel, status,
              created_at, opened_at, redeemed_at,
              latitude_sent, longitude_sent, latitude_redeemed, longitude_redeemed, is_demo
            ) VALUES (%s,%s,%s,%s,'redeemed',%s,%s,%s,%s,%s,%s,%s,1)
            """,
            (
                parent["invite_code"],
                inviter_id,
                invitee_id,
                channel,
                created,
                created + timedelta(hours=rng.randint(1, 24)),
                u["installed_at"],
                parent["latitude"],
                parent["longitude"],
                u["latitude"],
                u["longitude"],
            ),
        )
        invite_n += 1

    # Extra pending / opened invites (not yet converted)
    for inviter_i in rng.sample(range(len(users)), k=min(60, len(users))):
        parent = users[inviter_i]
        inviter_id = id_by_idx[inviter_i]
        for _ in range(rng.randint(0, 2)):
            status = rng.choice(["sent", "sent", "opened", "expired"])
            created = parent["installed_at"] + timedelta(days=rng.randint(1, 40))
            if created > now:
                created = now - timedelta(days=1)
            opened = created + timedelta(hours=rng.randint(1, 48)) if status in ("opened", "expired") else None
            cur.execute(
                """
                INSERT INTO Dash_AppInvites (
                  invite_code, inviter_user_id, invitee_user_id, channel, status,
                  created_at, opened_at, redeemed_at,
                  latitude_sent, longitude_sent, latitude_redeemed, longitude_redeemed, is_demo
                ) VALUES (%s,%s,NULL,%s,%s,%s,%s,NULL,%s,%s,NULL,NULL,1)
                """,
                (
                    parent["invite_code"],
                    inviter_id,
                    rng.choice(CHANNELS),
                    status,
                    created,
                    opened,
                    parent["latitude"],
                    parent["longitude"],
                ),
            )
            invite_n += 1

    cn.commit()

    # Events per user
    event_n = 0
    for i, u in enumerate(users):
        uid = id_by_idx[i]
        n_ev = min(u["session_count"] + rng.randint(1, 4), 12)
        for e in range(n_ev):
            et = rng.choice(EVENT_TYPES)
            if e == 0:
                et = "open"
            t = u["installed_at"] + timedelta(hours=rng.randint(0, max(1, int((now - u["installed_at"]).total_seconds() / 3600))))
            if t > now:
                t = now
            la, lo = jitter(u["latitude"], u["longitude"], f"ev-{uid}-{e}", 0.05)
            code = u["invite_code"] if et.startswith("invite") else (u["referred_by_code"] if et == "open" and e == 0 else None)
            cur.execute(
                """
                INSERT INTO Dash_AppEvents (
                  user_id, event_type, event_at, latitude, longitude, invite_code, meta_note, is_demo
                ) VALUES (%s,%s,%s,%s,%s,%s,%s,1)
                """,
                (
                    uid,
                    et,
                    t,
                    round(la, 6),
                    round(lo, 6),
                    code,
                    f"mock {et}" if rng.random() < 0.2 else None,
                ),
            )
            event_n += 1
        if i % 40 == 0:
            cn.commit()

    cn.commit()
    cur.close()
    cn.close()
    return len(users), invite_n, event_n


def main() -> None:
    rng = random.Random(42)  # deterministic demo graph
    print("Seeding Dash_AppUsers / Dash_AppInvites / Dash_AppEvents…")
    n_u, n_i, n_e = seed(rng)
    print(f"  Users:   {n_u}")
    print(f"  Invites: {n_i}")
    print(f"  Events:  {n_e}")
    print("Done (Dash_* only).")


if __name__ == "__main__":
    main()
