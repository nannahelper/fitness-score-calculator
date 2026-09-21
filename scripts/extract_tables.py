import json, re
from pathlib import Path
import xlrd

root=Path(__file__).resolve().parents[2] / 'static_resources'
out=Path(__file__).resolve().parents[1] / 'data'
book=xlrd.open_workbook(str(root/'体测分数对照表.xls'))

def clean(v):
    if isinstance(v,float) and v.is_integer(): return int(v)
    return v

def parse_time(v):
    if not v: return None
    s=str(v).replace('′',"'").replace('＇',"'").replace('″','"').replace('＂','"')
    m=re.search(r"(\d+)[':]\s*(\d+)",s)
    if not m: return None
    return int(m.group(1))*60+int(m.group(2))

def parse_sheet(sheet, gender):
    # rows 4..22, columns: grade, score, bmi, vital (year1,year3), sprint, jump, sit, endurance, strength
    rows=[]
    for r in range(4,23):
        vals=[sheet.cell_value(r,c) for c in range(sheet.ncols)]
        score=int(vals[1])
        rows.append({
          'score': score,
          'bmi': str(vals[2]) if vals[2] else None,
          'vital': [int(vals[3]),int(vals[4])],
          'sprint': [float(vals[5]),float(vals[6])],
          'jump': [int(vals[7]),int(vals[8])],
          'sitReach': [float(vals[9]),float(vals[10])],
          'endurance': [parse_time(vals[11]),parse_time(vals[12])],
          'strength': [int(vals[13]) if vals[13] else None,int(vals[14]) if vals[14] else None],
        })
    return rows
college={
 'source':'体测分数对照表.xls',
 'grades':[{'id':'freshman','label':'大一/大二','column':0},{'id':'senior','label':'大三/大四','column':1}],
 'weights':{'bmi':15,'vital':15,'sprint':20,'jump':10,'sitReach':10,'endurance':20,'strength':10},
 'bonus':{'strength':[[1,1],[2,2],[3,3],[4,4],[5,5],[6,6],[7,7],[8,8],[9,9],[10,10]],'endurance':[[4,1],[8,2],[12,3],[16,4],[20,5],[23,6],[26,7],[29,8],[32,9],[35,10]]},
 'genders':{'male':parse_sheet(book.sheet_by_name('男生'),'male'),'female':parse_sheet(book.sheet_by_name('女生'),'female')}
}
# Remove second duplicate xls from deliverable; source hash recorded separately.
# 2400 table: source values are Excel fractions of a day; convert to seconds.
b2400=xlrd.open_workbook(str(root/'南京大学体育部体测评分标准等要求.xls'))
s=b2400.sheet_by_name('2400米评分表')
rows=[]
for r in range(1,s.nrows):
    male_time=s.cell_value(r,0); male_score=s.cell_value(r,1); female_time=s.cell_value(r,3); female_score=s.cell_value(r,4)
    if isinstance(male_time,(int,float)) and isinstance(male_score,(int,float)):
        rows.append({'gender':'male','seconds':round(float(male_time)*1440,3),'score':round(float(male_score),1)})
    if isinstance(female_time,(int,float)) and isinstance(female_score,(int,float)):
        rows.append({'gender':'female','seconds':round(float(female_time)*1440,3),'score':round(float(female_score),1)})
# Separate by gender and normalize scores; the original table is 0.05 sec increments encoded as day fractions.
old={}
for gender in ('male','female'):
    sh=b2400.sheet_by_name('男子' if gender=='male' else '女子')
    headers=[str(sh.cell_value(0,c)) for c in range(sh.ncols)]
    vals=[]
    for r in range(1,sh.nrows):
        row=[sh.cell_value(r,c) for c in range(sh.ncols)]
        if row[1] != '': vals.append({'score':int(row[1]),'endurance':str(row[2]),'step':row[3],'sprint':row[4],'jump':row[5],'ball':row[6],'strength':row[7],'sitReach':row[8],'rope':row[9]})
    old[gender]={'headers':headers,'rows':vals}
college['legacyStandard']={'source':'南京大学体育部体测评分标准等要求.xls','2400m':{
 'male':[x for x in rows if x['gender']=='male'], 'female':[x for x in rows if x['gender']=='female']},'school':old}
(out/'college.json').write_text(json.dumps(college,ensure_ascii=False,indent=2)+'\n')
print('wrote',out/'college.json', 'size', (out/'college.json').stat().st_size)
print('college rows',len(college['genders']['male']),len(college['genders']['female']),'2400',len(rows))
