# -*- coding: utf-8 -*-
import openpyxl

wb = openpyxl.load_workbook(r"d:\projects\sellsim\docs\plans.xlsx", data_only=True)
for ws in wb.worksheets:
    print(f"=== Sheet: {ws.title} (dims={ws.dimensions}) ===")
    for row in ws.iter_rows():
        cells = []
        for c in row:
            v = c.value
            if v is None:
                cells.append("")
            else:
                cells.append(str(v))
        # skip fully empty rows
        if any(x.strip() != "" for x in cells):
            print(" | ".join(cells))