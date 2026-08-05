"""Shared helpers for country-linked public data loaders."""
from __future__ import annotations

import sys
from pathlib import Path

import pymysql
import pycountry

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from test_mysql_connection import load_env

NAME_ALIASES: dict[str, str] = {
    "Congo, Dem. Rep.": "Congo, Dem. Rep.",
    "Congo, Rep.": "Congo, Rep.",
    "Cote d' Ivoire": "Côte d'Ivoire",
    "Korea, South": "Korea, Rep.",
    "Korea, North": "Korea, Dem. People's Rep.",
    "South Korea": "Korea, Rep.",
    "North Korea": "Korea, Dem. People's Rep.",
    "Laos": "Lao PDR",
    "Syria": "Syrian Arab Republic",
    "Russia": "Russian Federation",
    "Tanzania": "Tanzania",
    "United States": "United States",
    "Vietnam": "Viet Nam",
    "Iran": "Iran, Islamic Rep.",
    "Bolivia": "Bolivia",
    "Venezuela": "Venezuela, RB",
    "Turkey": "Turkiye",
    "Moldova": "Moldova",
    "Czech Republic": "Czechia",
    "North Macedonia": "North Macedonia",
    "Eswatini": "Eswatini",
    "Cape Verde": "Cabo Verde",
    "East Timor": "Timor-Leste",
    "Brunei": "Brunei Darussalam",
    "Micronesia": "Micronesia, Fed. Sts.",
    "Palestine": "West Bank and Gaza",
    "Holy See (Vatican)": "Holy See",
    "Ivory Coast": "Côte d'Ivoire",
    "Democratic Republic of the Congo": "Congo, Dem. Rep.",
    "Republic of the Congo": "Congo, Rep.",
    "Central African Republic": "Central African Republic",
}

USER_AGENT = "NewGenData/1.0 (country-data-loader)"


def connect() -> pymysql.Connection:
    env = load_env(ROOT / ".env")
    kw = dict(
        host=env["MYSQL_HOST"].strip(),
        port=int(env.get("MYSQL_PORT") or 3306),
        user=env["MYSQL_USER"].strip(),
        password=env["MYSQL_PASSWORD"].strip(),
        database=env["MYSQL_DATABASE"].strip(),
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
    )
    if (env.get("MYSQL_SSL") or "").lower() in ("1", "true", "yes", "required"):
        kw["ssl"] = {"ssl_verify_cert": False, "ssl_verify_identity": False}
    return pymysql.connect(**kw)


def resolve_iso3(country_name: str, wb_by_name: dict[str, str] | None = None) -> str | None:
    alias = NAME_ALIASES.get(country_name, country_name)
    if wb_by_name and alias in wb_by_name:
        return wb_by_name[alias]
    p = pycountry.countries.get(name=alias)
    if p:
        return p.alpha_3
    for c in pycountry.countries:
        if c.name.lower() == alias.lower():
            return c.alpha_3
    if wb_by_name:
        low = alias.lower()
        for wb_name, iso3 in wb_by_name.items():
            if wb_name.lower() == low:
                return iso3
    return None


def load_country_maps(cur) -> tuple[dict[str, int], dict[str, int], dict[int, str]]:
    """Return iso3->country_id, iso2->country_id, country_id->name from DB."""
    cur.execute(
        """
        SELECT c.country_id, c.country_name, cc.iso2, cc.iso3
        FROM Countries c
        LEFT JOIN country_codes cc ON cc.country_id = c.country_id
        ORDER BY c.country_id
        """
    )
    iso3_map: dict[str, int] = {}
    iso2_map: dict[str, int] = {}
    id_name: dict[int, str] = {}
    for row in cur.fetchall():
        cid = row["country_id"]
        id_name[cid] = row["country_name"]
        if row.get("iso3"):
            iso3_map[row["iso3"]] = cid
        if row.get("iso2"):
            iso2_map[row["iso2"]] = cid
    return iso3_map, iso2_map, id_name


def ensure_country_codes(cur, wb_by_name: dict[str, str] | None = None) -> None:
    """Fill iso3/iso2 on country_codes for rows missing them (best effort)."""
    _, _, id_name = load_country_maps(cur)
    for cid, cname in id_name.items():
        cur.execute("SELECT iso3 FROM country_codes WHERE country_id = %s", (cid,))
        row = cur.fetchone()
        if row and row.get("iso3"):
            continue
        iso3 = resolve_iso3(cname, wb_by_name)
        if not iso3:
            continue
        iso2 = None
        p = pycountry.countries.get(alpha_3=iso3)
        if p:
            iso2 = p.alpha_2
        if row:
            cur.execute(
                "UPDATE country_codes SET iso2 = COALESCE(iso2, %s), iso3 = %s WHERE country_id = %s",
                (iso2, iso3, cid),
            )
        else:
            cur.execute(
                "INSERT INTO country_codes (country_id, iso2, iso3) VALUES (%s, %s, %s)",
                (cid, iso2, iso3),
            )


POLITICAL_REGIME_LABELS: dict[str, str] = {
    "0": "closed autocracy",
    "1": "electoral autocracy",
    "2": "electoral democracy",
    "3": "liberal democracy",
}


def create_country_views(cur) -> None:
    """Rebuild v_country_profile and v_engagement_country_profile with all enrichment tables."""
    cur.execute("DROP VIEW IF EXISTS v_engagement_country_profile")
    cur.execute("DROP VIEW IF EXISTS v_country_profile")
    cur.execute(
        """
        CREATE VIEW v_country_profile AS
        SELECT
          c.country_id,
          c.country_name,
          cc.iso2,
          cc.iso3,
          cc.capital_city,
          cc.latitude AS country_latitude,
          cc.longitude AS country_longitude,
          cc.wb_region,
          cc.income_level,
          cc.primary_languages,
          gn.area_sq_km,
          gn.currency_code,
          gn.phone_prefix,
          d.population_total,
          d.population_growth_pct,
          d.urban_population_pct,
          d.literacy_rate_adult_pct,
          d.life_expectancy_years,
          d.gdp_per_capita_usd,
          d.internet_users_pct,
          h.hdi_value,
          h.hdi_year,
          h.owid_region,
          r.most_common_religion,
          r.share_religious_pct,
          r.share_religious_year,
          rb.christian_pct,
          rb.muslim_pct,
          rb.hindu_pct,
          rb.buddhist_pct,
          rb.unaffiliated_pct,
          rb.religion_data_year,
          edu.mean_years_schooling,
          edu.expected_years_schooling,
          edu.median_age,
          soc.corruption_cpi,
          soc.forest_cover_pct,
          soc.undernourishment_pct,
          soc.political_regime,
          soc.political_regime_label,
          soc.refugee_population_origin,
          soc.population_density,
          soc.maternal_mortality_per_100k,
          ho.under5_mortality_per_1000,
          x.gini_index,
          x.health_expenditure_pct_gdp,
          x.education_expenditure_pct_gdp,
          x.mobile_subscriptions_per_100,
          x.women_in_parliament_pct,
          m.age_dependency_ratio_pct,
          m.hiv_prevalence_pct_15_49,
          m.female_unemployment_pct,
          (SELECT COUNT(*) FROM country_places p WHERE p.country_id = c.country_id) AS place_count,
          (SELECT COUNT(*) FROM country_places p WHERE p.country_id = c.country_id AND p.population >= 50000) AS cities_over_50k,
          (SELECT COUNT(*) FROM country_admin1 a WHERE a.country_id = c.country_id) AS admin1_count,
          (SELECT COUNT(*) FROM country_borders b WHERE b.country_id = c.country_id) AS border_count
        FROM Countries c
        LEFT JOIN country_codes cc ON cc.country_id = c.country_id
        LEFT JOIN country_geonames gn ON gn.country_id = c.country_id
        LEFT JOIN country_demographics_wb d ON d.country_id = c.country_id
        LEFT JOIN country_hdi h ON h.country_id = c.country_id
        LEFT JOIN country_religion r ON r.country_id = c.country_id
        LEFT JOIN country_religion_breakdown rb ON rb.country_id = c.country_id
        LEFT JOIN country_education_owid edu ON edu.country_id = c.country_id
        LEFT JOIN country_society_owid soc ON soc.country_id = c.country_id
        LEFT JOIN country_health_owid ho ON ho.country_id = c.country_id
        LEFT JOIN country_demographics_wb_extra x ON x.country_id = c.country_id
        LEFT JOIN country_demographics_wb_more m ON m.country_id = c.country_id
        """
    )
    cur.execute(
        """
        CREATE VIEW v_engagement_country_profile AS
        SELECT
          e.*,
          cp.iso2,
          cp.iso3,
          cp.capital_city,
          cp.country_latitude,
          cp.country_longitude,
          cp.wb_region,
          cp.income_level,
          cp.primary_languages,
          cp.area_sq_km,
          cp.population_total,
          cp.population_growth_pct,
          cp.urban_population_pct,
          cp.literacy_rate_adult_pct,
          cp.life_expectancy_years,
          cp.gdp_per_capita_usd,
          cp.internet_users_pct,
          cp.hdi_value,
          cp.hdi_year,
          cp.most_common_religion,
          cp.share_religious_pct,
          cp.christian_pct,
          cp.muslim_pct,
          cp.mean_years_schooling,
          cp.expected_years_schooling,
          cp.median_age,
          cp.corruption_cpi,
          cp.political_regime_label,
          cp.undernourishment_pct,
          cp.gini_index,
          cp.place_count,
          cp.admin1_count
        FROM engagments_new e
        LEFT JOIN v_country_profile cp ON cp.country_id = e.country_id
        """
    )
