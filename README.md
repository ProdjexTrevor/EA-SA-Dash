# EA-SA Dash

Quarterly reporting dashboard scoped to **three regions**:

| Region | Source |
|--------|--------|
| **East Africa** | Live history copied into `Dash_*` tables |
| **Southern Africa** | Live history copied into `Dash_*` tables |
| **The Moon** | Demo / seeded historical data |

Forked from the New Generation reporting app; reads only **`Dash_*` tables** so production `all_data` is never written by this app.

Repo: [github.com/ProdjexTrevor/EA-SA-Dash](https://github.com/ProdjexTrevor/EA-SA-Dash)

---

## Database tables (prefix `Dash_`)

Created in the same MySQL database as production (`newgendata`). MySQL user cannot create a separate `Dash` schema, so tables are named:

- `Dash_Regions`
- `Dash_Countries`
- `Dash_PartnerOrg`
- `Dash_Engagements`
- `Dash_PeopleGroups`
- `Dash_Leaders`
- `Dash_Disciples`
- `Dash_all_data`

`is_demo = 1` marks Moon / fictional rows.

### Seed / refresh

```powershell
cd EA-SA-Dash
# Requires MYSQL_* in .env (same DigitalOcean DB is fine)
npm run seed:dash
# or: python scripts/create_and_seed_dash_tables.py
```

This **truncates** `Dash_*` tables, re-copies all EA + SA history from production `all_data`, and re-seeds The Moon (quarters 2018–Q1’26).

---

## Local run

```powershell
cd EA-SA-Dash
copy .env.example .env
# Fill MYSQL_* (same DigitalOcean DB is fine — app only queries Dash_*)

npm install
cd server; npm install; cd ..
cd client; npm install; cd ..
npm run dev
```

- UI: http://localhost:5174  
- API: http://localhost:3010/api/health  

---

## Pages

1. Quarterly report (drill-down)  
2. Quarter report (simple)  
3. Compare regions & countries  
4. Regional scorecard  
5. Trends over time  

---

## Vercel

Same pattern as newgendash: client + serverless API.

1. Import this GitHub repo into Vercel.  
2. Set **Root Directory** to repo root (uses root `vercel.json`).  
3. Environment variables: `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`, `MYSQL_SSL=true`.  
4. Build command: `npm run build:vercel` (if configured in `vercel.json`).

Tell the agent when the Vercel project is linked if you need env / build settings wired up.
