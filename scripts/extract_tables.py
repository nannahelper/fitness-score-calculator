"""Extract the versioned score data used by the static calculator.

Run from the repository workspace with xlrd 2.x installed. The source XLS files
live in ../static_resources relative to this repository.
"""
import json
import re
from pathlib import Path
import xlrd

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "static_resources"
OUT = Path(__file__).resolve().parents[1] / "data" / "college.json"
WEIGHTS = {"bmi": 15, "vital": 15, "sprint": 20, "jump": 10, "sitReach": 10, "endurance": 20, "strength": 10}
BONUS = {"strength": [[i, i] for i in range(1, 11)], "endurance": [[4, 1], [8, 2], [12, 3], [16, 4], [20, 5], [23, 6], [26, 7], [29, 8], [32, 9], [35, 10]]}

def time_seconds(value):
    if not value:
        return None
    match = re.search(r"(\d+)[':]\s*(\d+)", str(value).replace("′", "'").replace("″", '"'))
    return int(match.group(1)) * 60 + int(match.group(2)) if match else None

def university_sheet(sheet):
    rows = []
    for r in range(4, 23):
        v = [sheet.cell_value(r, c) for c in range(sheet.ncols)]
        rows.append({
            "score": int(v[1]), "bmi": str(v[2]) if v[2] else None,
            "vital": [int(v[3]), int(v[4])], "sprint": [float(v[5]), float(v[6])],
            "jump": [int(v[7]), int(v[8])], "sitReach": [float(v[9]), float(v[10])],
            "endurance": [time_seconds(v[11]), time_seconds(v[12])],
            "strength": [int(v[13]) if v[13] else None, int(v[14]) if v[14] else None],
        })
    return rows

def table_2400(book, sheet_name):
    sheet = book.sheet_by_name(sheet_name)
    result = {"male": [], "female": []}
    for r in range(2, sheet.nrows):
        for gender, time_col, score_col in (("male", 0, 1), ("female", 3, 4)):
            t, score = sheet.cell_value(r, time_col), sheet.cell_value(r, score_col)
            if isinstance(t, (int, float)) and isinstance(score, (int, float)):
                # The spreadsheets store “10:30” as an Excel day fraction.
                result[gender].append({"seconds": round(float(t) * 1440, 3), "score": round(float(score), 1)})
    return result

def spring_strength(book):
    sheet = book.sheet_by_name("引体向上 仰卧起坐")
    result = []
    for r in range(3, sheet.nrows):
        points = sheet.cell_value(r, 1)
        if not isinstance(points, (int, float)):
            continue
        numbers = [re.search(r"\d+", str(sheet.cell_value(r, c))) for c in (0, 2)]
        result.append({"pullUp": int(numbers[0].group()), "sitUp": int(numbers[1].group()), "score": float(points)})
    return result

def version(genders, run2400, source, strength=None, school=None):
    value = {"weights": WEIGHTS, "bonus": BONUS, "genders": genders, "legacyStandard": {"source": source, "2400m": run2400}}
    if strength is not None:
        value["springStrength"] = strength
    if school is not None:
        value["legacyStandard"]["school"] = school
    return value

def main():
    old_college = xlrd.open_workbook(str(SOURCE / "体测分数对照表.xls"))
    old_rules = xlrd.open_workbook(str(SOURCE / "南京大学体育部体测评分标准等要求.xls"))
    new_book = xlrd.open_workbook(str(SOURCE / "南京大学春秋体测分数对照表.xls"))
    old_school = {}
    for gender, sheet_name in (("male", "男子"), ("female", "女子")):
        sheet = old_rules.sheet_by_name(sheet_name)
        old_school[gender] = {"headers": [str(sheet.cell_value(0, c)) for c in range(sheet.ncols)], "rows": []}
        for r in range(1, sheet.nrows):
            row = [sheet.cell_value(r, c) for c in range(sheet.ncols)]
            if row[1] != "":
                old_school[gender]["rows"].append({"score": int(row[1]), "endurance": str(row[2]), "step": row[3], "sprint": row[4], "jump": row[5], "ball": row[6], "strength": row[7], "sitReach": row[8], "rope": row[9]})
    old_version = version(
        {"male": university_sheet(old_college.sheet_by_name("男生")), "female": university_sheet(old_college.sheet_by_name("女生"))},
        table_2400(old_rules, "2400米评分表"), "体测分数对照表.xls + 南京大学体育部体测评分标准等要求.xls", school=old_school)
    current_version = version(
        {"male": university_sheet(new_book.sheet_by_name("秋季男生")), "female": university_sheet(new_book.sheet_by_name("秋季女生"))},
        table_2400(new_book, "2400"), "南京大学春秋体测分数对照表.xls", strength=spring_strength(new_book))
    payload = {"source": "版本化体测评分数据", "grades": [{"id": "freshman", "label": "大一/大二", "column": 0}, {"id": "senior", "label": "大三/大四", "column": 1}], "versions": {"springAutumn": current_version, "legacy": old_version}}
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes); current 2400 rows: {len(current_version['legacyStandard']['2400m']['male'])}/{len(current_version['legacyStandard']['2400m']['female'])}")

if __name__ == "__main__":
    main()
