import { describe, expect, it } from "vitest";
import { mysqlToPostgres } from "./db.js";

describe("mysqlToPostgres", () => {
  it("rewrites date format, quotes, and placeholders", () => {
    const sql = mysqlToPostgres(
      "SELECT DATE_FORMAT(`date`, '%Y-%m-%d') AS d FROM Dash_all_data WHERE `date` = ? LIMIT ?"
    );
    expect(sql).toContain("TO_CHAR");
    expect(sql).toContain('"date"');
    expect(sql).toContain('"Dash_all_data"');
    expect(sql).toContain("$1");
    expect(sql).toContain("$2");
    expect(sql).not.toContain("?");
  });

  it("rewrites GROUP_CONCAT latest-value pattern", () => {
    const sql = mysqlToPostgres(
      "SELECT SUBSTRING_INDEX(GROUP_CONCAT(region ORDER BY `date` DESC), ',', 1) AS region FROM Dash_all_data"
    );
    expect(sql).toContain("ARRAY_AGG");
    expect(sql).toContain('"Dash_all_data"');
  });

  it("rewrites DATABASE() to current_schema()", () => {
    const sql = mysqlToPostgres(
      "SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'Dash_AppUsers'"
    );
    expect(sql).toContain("current_schema()");
    expect(sql).not.toMatch(/DATABASE\s*\(/i);
  });
});
