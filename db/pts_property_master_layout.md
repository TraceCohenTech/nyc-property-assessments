# NYC DOF PTS Property Master File — Official Record Layout

Source: https://www.nyc.gov/assets/finance/downloads/tar/layout-pts-property-master.xlsx
Files this applies to: `PROPMAST_TC1_2027_FIN.txt` (706,713 rows, tax class 1) and
`PROPMAST_TC234_T2027_FIN.TXT` (tax classes 2/3/4, from fy27_tc234.zip).

Format: one record per line, fields **tab-separated in this exact order** (139 fields).
Values are stored as fixed-width strings padded with spaces (text) or zero-padded with a
leading `+`/`-` sign (numeric), e.g. `+00003717000` = 3,717,000. Strip the sign char and
leading zeros, cast to int; treat all-blank fields as null.

| # | Field | Description | Len | Notes |
|---|---|---|---|---|
| 1 | PARID | Parcel Identifier (boro+block+lot+ease+subident concat) | 30 | |
| 2 | BORO | Borough: 1=Manhattan,2=Bronx,3=Brooklyn,4=Queens,5=Staten Island | 1 | |
| 3 | BLOCK | Tax block | 5 | |
| 4 | LOT | Tax lot | 4 | |
| 5 | EASE | Easement code | 1 | blank/A/B/E/F-M/N/P/R/S/U |
| 6 | SUBIDENT_REUC | REUC sub-ident (RECTYPE=3 only) | 10 | |
| 7 | RECTYPE | 1=Ordinary RE, 2=REUC Ident, 3=REUC Sub-ident | 1 | |
| 8 | TAXYR | Tax year | 4 | |
| 9 | IDENT | REUC Ident (RECTYPE 2/3 only) | 10 | |
| 10 | SUBIDENT | REUC Sub-ident (RECTYPE 3 only) | 10 | |
| 11 | ROLL_SECTION | 1=Special Franchise,3=Power/Gas,5=Comms,7=Railroad | 1 | |
| 12 | SECVOL | Section volume number | 5 | |
| 13 | PYMKTLAND | Prior Year Market Land Value | 12 | |
| 14 | PYMKTTOT | Prior Year Market Total Value | 12 | |
| 15 | PYACTLAND | Prior Year Actual Land Value | 12 | |
| 16 | PYACTTOT | Prior Year Actual Total Value | 12 | |
| 17 | PYACTEXTOT | Prior Year Actual Exemption Total | 12 | |
| 18 | PYTRNLAND | Prior Year Transitional Land Value | 12 | |
| 19 | PYTRNTOT | Prior Year Transitional Total Value | 12 | |
| 20 | PYTRNEXTOT | Prior Year Transitional Exemption Total | 12 | |
| 21 | PYTXBTOT | Prior Year Taxable Total | 12 | |
| 22 | PYTXBEXTOT | Prior Year Taxable Exemption Total | 12 | |
| 23 | PYTAXCLASS | Prior Year Tax Class | 2 | |
| 24 | TENMKTLAND | Tentative Market Land Value | 12 | |
| 25 | TENMKTTOT | Tentative Market Total Value | 12 | |
| 26 | TENACTLAND | Tentative Actual Land Value | 12 | |
| 27 | TENACTTOT | Tentative Actual Total Value | 12 | |
| 28 | TENACTEXTOT | Tentative Actual Exemption Total | 12 | |
| 29 | TENTRNLAND | Tentative Transitional Land Value | 12 | |
| 30 | TENTRNTOT | Tentative Transitional Total Value | 12 | |
| 31 | TENTRNEXTOT | Tentative Transitional Exemption Total | 12 | |
| 32 | TENTXBTOT | Tentative Taxable Total | 12 | |
| 33 | TENTXBEXTOT | Tentative Taxable Exemption Total | 12 | |
| 34 | TENTAXCLASS | Tentative Tax Class | 2 | |
| 35 | CBNMKTLAND | Change-By-Notice Market Land Value | 12 | |
| 36 | CBNMKTTOT | Change-By-Notice Market Total Value | 12 | |
| 37 | CBNACTLAND | Change-By-Notice Actual Land Value | 12 | |
| 38 | CBNACTTOT | Change-By-Notice Actual Total Value | 12 | |
| 39 | CBNACTEXTOT | Change-By-Notice Actual Exemption Total | 12 | |
| 40 | CBNTRNLAND | Change-By-Notice Transitional Land Value | 12 | |
| 41 | CBNTRNTOT | Change-By-Notice Transitional Total Value | 12 | |
| 42 | CBNTRNEXTOT | Change-By-Notice Transitional Exemption Total | 12 | |
| 43 | CBNTXBTOT | Change-By-Notice Taxable Total | 12 | |
| 44 | CBNTXBEXTOT | Change-By-Notice Taxable Exemption Total | 12 | |
| 45 | CBNTAXCLASS | Change-By-Notice Tax Class | 2 | |
| 46 | FINMKTLAND | **Final Market Land Value** | 12 | primary value field |
| 47 | FINMKTTOT | **Final Market Total Value** | 12 | primary value field |
| 48 | FINACTLAND | Final Actual Land Value | 12 | |
| 49 | FINACTTOT | **Final Actual Total (Assessed) Value** | 12 | primary value field |
| 50 | FINACTEXTOT | Final Actual Exemption Total | 12 | |
| 51 | FINTRNLAND | Final Transitional Land Value | 12 | |
| 52 | FINTRNTOT | Final Transitional Total Value | 12 | |
| 53 | FINTRNEXTOT | Final Transitional Exemption Total | 12 | |
| 54 | FINTXBTOT | **Final Taxable Total (what tax is actually billed on)** | 12 | primary value field |
| 55 | FINTXBEXTOT | Final Taxable Exemption Total | 12 | |
| 56 | FINTAXCLASS | **Final Tax Class** | 2 | 1,2,3,4 |
| 57 | CURMKTLAND | Current Market Land Value | 12 | |
| 58 | CURMKTTOT | Current Market Total Value | 12 | |
| 59 | CURACTLAND | Current Actual Land Value | 12 | |
| 60 | CURACTTOT | Current Actual Total Value | 12 | |
| 61 | CURACTEXTOT | Current Actual Exemption Total | 12 | |
| 62 | CURTRNLAND | Current Transitional Land Value | 12 | |
| 63 | CURTRNTOT | Current Transitional Total Value | 12 | |
| 64 | CURTRNEXTOT | Current Transitional Exemption Total | 12 | |
| 65 | CURTXBTOT | Current Taxable Total | 12 | |
| 66 | CURTXBEXTOT | Current Taxable Exemption Total | 12 | |
| 67 | CURTAXCLASS | Current Tax Class | 2 | |
| 68 | PERIOD | 0=new yr,1=tentative,2=CBN done,3=final published,4=remission | 1 | |
| 69 | NEWDROP | 0 or 1=new lot | 1 | |
| 70 | NOAV | 0 or Y=building in progress | 1 | |
| 71 | VALREF | Y=values reflected in another lot | 1 | |
| 72 | BLDG_CLASS | **Building Class code** (e.g. A4, R8B, B1) | 2 | |
| 73 | OWNER | **Owner's Name** | 80 | |
| 74 | ZONING | Zoning code (DCP) | 10 | |
| 75 | HOUSENUM_LO | Lowest house number | 12 | |
| 76 | HOUSENUM_HI | Highest house number | 12 | |
| 77 | STREET_NAME | **Street Name** | 30 | |
| 78 | ZIP_CODE | **Zip code** | 10 | |
| 79 | GEOSUPPORT_RC | Geosupport verification status | 2 | |
| 80 | STCODE | 10-digit street code w/ boro prefix | 12 | |
| 81 | LOT_FRT | Lot Frontage (ft) | 8 | |
| 82 | LOT_DEP | Lot Depth (ft) | 8 | |
| 83 | LOT_IRREG | R=regular, I=irregular | 1 | |
| 84 | BLD_FRT | Building Frontage (ft) | 8 | |
| 85 | BLD_DEP | Building Depth (ft) | 8 | |
| 86 | BLD_EXT | E=Extension, G=Garage, EG=both | 2 | |
| 87 | BLD_STORY | # stories/floors | 7 | |
| 88 | CORNER | 00/NE/NW/SE/SW/CR | 2 | |
| 89 | LAND_AREA | Total Land Area (sqft) | 10 | |
| 90 | NUM_BLDGS | # buildings on lot | 6 | |
| 91 | YRBUILT | **Year built** | 4 | |
| 92 | YRBUILT_RANGE | last year of range if built over yrs | 4 | |
| 93 | YRBUILT_FLAG | E=estimate | 1 | |
| 94 | YRALT1 | Year of alteration 1 | 4 | |
| 95 | YRALT1_RANGE | | 4 | |
| 96 | YRALT2 | Year of alteration 2 | 4 | |
| 97 | YRALT2_RANGE | | 4 | |
| 98 | COOP_APTS | # residential units | 6 | |
| 99 | UNITS | Total # units | 6 | |
| 100 | REUC_REF | REUC ident ref | 20 | |
| 101 | APTNO | Apartment # (condos) | 10 | |
| 102 | COOP_NUM | Coop ID number | 7 | |
| 103 | CPB_BORO | Community planning board boro | 1 | |
| 104 | CPB_DIST | **Community district number** | 2 | |
| 105 | APPT_DATE | Most recent apportionment date | 8 | |
| 106 | APPT_BORO | Apportionment boro | 1 | |
| 107 | APPT_BLOCK | Apportionment block | 5 | |
| 108 | APPT_LOT | Apportionment lot | 4 | |
| 109 | APPT_EASE | Apportionment easement | 1 | |
| 110 | CONDO_NUMBER | Condo ID number | 6 | |
| 111 | CONDO_SFX1 | C=commercial,R=residential,blank=all one | 1 | |
| 112 | CONDO_SFX2 | Suffix 1 seq # | 1 | |
| 113 | CONDO_SFX3 | Not used | 1 | |
| 114 | UAF_LAND | Land % common interest in condo | 12 | |
| 115 | UAF_BLDG | Building % common interest in condo | 12 | |
| 116 | PROTEST_1 | Protest code | 3 | |
| 117 | PROTEST_2 | 2nd protest code | 3 | |
| 118 | PROTEST_OLD | | 3 | |
| 119 | ATTORNEY_GROUP1 | Protest attorney ID | 4 | |
| 120 | ATTORNEY_GROUP2 | | 4 | |
| 121 | ATTORNEY_GROUP_OLD | | 4 | |
| 122 | GROSS_SQFT | **Gross building square footage** | 10 | |
| 123 | HOTEL_AREA_GROSS | | 9 | |
| 124 | OFFICE_AREA_GROSS | | 9 | |
| 125 | RESIDENTIAL_AREA_GROSS | | 9 | |
| 126 | RETAIL_AREA_GROSS | | 9 | |
| 127 | LOFT_AREA_GROSS | | 9 | |
| 128 | FACTORY_AREA_GROSS | | 9 | |
| 129 | WAREHOUSE_AREA_GROSS | | 9 | |
| 130 | STORAGE_AREA_GROSS | | 9 | |
| 131 | GARAGE_AREA | | 9 | |
| 132 | OTHER_AREA_GROSS | | 9 | |
| 133 | REUC_DESCRIPTION | | 500 | |
| 134 | EXTRACTDT | Data extract date (YYYYMMDD) | 8 | |
| 135 | PYTAXFLAG | T=Transitional, A=Actual | 1 | |
| 136 | TENTAXFLAG | | 1 | |
| 137 | CBNTAXFLAG | | 1 | |
| 138 | FINTAXFLAG | | 1 | |
| 139 | CURTAXFLAG | | 1 | |

## Practical notes from inspecting the raw file
- Confirmed via `od -c` on TC1 file: fields ARE tab-separated, values are fixed-width
  space/zero-padded within each tab-delimited field (both tabs AND padding present).
  Split on `\t` first, then `.strip()` each field before parsing.
- Numeric fields: sign char (`+`/`-`) immediately followed by zero-padded digits, e.g.
  `+00003717000` → 3717000. LOT_FRT/LOT_DEP/etc have decimals baked in, e.g. `+0025.00`.
- Row count TC1 file: 706,713. TC234 file (`PROPMAST_TC234_T2027_FIN.TXT` inside
  fy27_tc234.zip) is larger (844MB) — count before processing.
- FY27 = Fiscal Year 2027 = NYC's assessment roll published ~May 2026 for tax year
  starting July 2026. TAXYR field will read 2027.
- Files: TC1 = tax class 1 (1-3 family homes, small residential). TC234 = tax classes
  2 (rentals/coops/condos 4+ units), 3 (utility), 4 (commercial/industrial/office).
- Use FIN* (final) fields as the headline "current assessment" — fall back to TEN*
  (tentative) if FIN* is blank (period<3) since fy2027 is described as "final" per
  filenames (_FIN suffix), FIN* should be populated for all rows, but code defensively.
- Effective tax rate / burden = FINTXBTOT (taxable assessed value) × the applicable NYC
  class tax rate, NOT FINMKTTOT. Assessed value ≠ market value — that gap (assessment
  ratio) is itself an interesting inequity metric to visualize (NYC caps annual assessment
  increases differently per class, which is why Class 1 assessed/market ratios run far
  lower than Class 2/4 — a well-known equity story).
