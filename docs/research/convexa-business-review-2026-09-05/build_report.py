from pathlib import Path
import re, html, json, hashlib
from collections import Counter
from reportlab.pdfgen import canvas
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, CondPageBreak, LongTable, TableStyle, KeepTogether
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / 'report-source.md'
OUTPUT = ROOT / 'Convexa-Quantitative-and-Business-Review-2026-09-05.pdf'
FONTROOT = Path('C:/Windows/Fonts')
for name, filename in [('Body','arial.ttf'),('BodyBold','arialbd.ttf'),('BodyItalic','ariali.ttf'),('BodyBoldItalic','arialbi.ttf')]:
    pdfmetrics.registerFont(TTFont(name,str(FONTROOT/filename)))
pdfmetrics.registerFontFamily('Body',normal='Body',bold='BodyBold',italic='BodyItalic',boldItalic='BodyBoldItalic')

NAVY=colors.HexColor('#152532')
INK=colors.HexColor('#263640')
MUTED=colors.HexColor('#586771')
ACCENT=colors.HexColor('#B47722')
PALE=colors.HexColor('#F2F5F6')
RULE=colors.HexColor('#D4DDE1')
LINK=colors.HexColor('#176580')
PAGE_W,PAGE_H=595.276,841.89
WIDTH=PAGE_W-98

styles={
 'body':ParagraphStyle('body',fontName='Body',fontSize=10.1,leading=14.25,textColor=INK,spaceAfter=8.5,splitLongWords=True,allowWidows=0,allowOrphans=0),
 'title':ParagraphStyle('title',fontName='BodyBold',fontSize=42,leading=46,textColor=NAVY,spaceBefore=18,spaceAfter=10),
 'subtitle':ParagraphStyle('subtitle',fontName='Body',fontSize=22,leading=28,textColor=NAVY,spaceAfter=20),
 'h2':ParagraphStyle('h2',fontName='BodyBold',fontSize=23,leading=28,textColor=NAVY,spaceAfter=15,keepWithNext=True),
 'h3':ParagraphStyle('h3',fontName='BodyBold',fontSize=12.6,leading=16,textColor=NAVY,spaceBefore=13,spaceAfter=7,keepWithNext=True),
 'bullet':ParagraphStyle('bullet',fontName='Body',fontSize=10.1,leading=14.25,textColor=INK,spaceAfter=7,leftIndent=13,firstLineIndent=-10,splitLongWords=True,allowWidows=0,allowOrphans=0),
 'cell':ParagraphStyle('cell',fontName='Body',fontSize=8.6,leading=11.6,textColor=INK,spaceAfter=0,splitLongWords=True),
 'cellhead':ParagraphStyle('cellhead',fontName='BodyBold',fontSize=8.7,leading=11.5,textColor=colors.white,spaceAfter=0,splitLongWords=True),
}

LINK_RE=re.compile(r'\[([^\]]+)\]\((https?://[^\s)]+)\)')
def inline(text):
    # Protect Markdown links and inline code before escaping plain text.
    pieces=[]
    pat=re.compile(r'\[([^\]]+)\]\((https?://[^\s)]+)\)|`([^`]+)`')
    pos=0
    def plain(t):
        t=html.escape(t)
        t=re.sub(r'\*\*(.+?)\*\*',r'<b>\1</b>',t)
        return t
    for m in pat.finditer(text):
        pieces.append(plain(text[pos:m.start()]))
        if m.group(1):
            pieces.append('<link href="'+html.escape(m.group(2),quote=True)+'" color="#176580"><u>'+plain(m.group(1))+'</u></link>')
        else:
            pieces.append('<font color="#425967" size="9">'+html.escape(m.group(3))+'</font>')
        pos=m.end()
    pieces.append(plain(text[pos:]))
    return ''.join(pieces)

class ReportDoc(SimpleDocTemplate):
    def afterFlowable(self, flowable):
        if isinstance(flowable,Paragraph) and flowable.style.name=='h2':
            title=flowable.getPlainText()
            key='section-'+str(self.page)+'-'+str(len(title))
            self.canv.bookmarkPage(key)
            self.canv.addOutlineEntry(title,key,level=0,closed=False)

def frame(c,doc):
    c.saveState()
    c.setFillColor(NAVY)
    c.rect(0,PAGE_H-8,PAGE_W,8,fill=1,stroke=0)
    c.setFont('BodyBold',8)
    c.setFillColor(MUTED)
    c.drawString(49,PAGE_H-33,'CONVEXA  /  QUANTITATIVE & BUSINESS REVIEW')
    c.setStrokeColor(ACCENT)
    c.setLineWidth(1.1)
    c.line(49,PAGE_H-44,PAGE_W-49,PAGE_H-44)
    c.setStrokeColor(RULE)
    c.setLineWidth(.5)
    c.line(49,43,PAGE_W-49,43)
    c.setFont('Body',7.6)
    c.setFillColor(MUTED)
    c.drawString(49,29,'September 2026  |  Reference 350ae973  |  Read-only source review')
    c.drawRightString(PAGE_W-49,29,str(doc.page))
    c.restoreState()

raw=SOURCE.read_text(encoding='utf-8')
raw=raw.replace('\u2011','-').replace('\u2013','-').replace('\u2014','-')
lines=raw.splitlines()
story=[]
table_count=0
section_count=0
i=0
while i<len(lines):
    line=lines[i].strip()
    if not line:
        i+=1; continue
    if line=='<!-- pagebreak -->':
        story.extend([CondPageBreak(220),Spacer(1,18)]); i+=1; continue
    if line.startswith('# '):
        story.append(Paragraph(inline(line[2:]),styles['title'])); i+=1; continue
    if line.startswith('## '):
        key='h2' if re.match(r'\d+\.',line[3:]) else 'subtitle'
        story.append(Paragraph(inline(line[3:]),styles[key])); section_count+=key=='h2'; i+=1; continue
    if line.startswith('### '):
        if line.startswith('### F. Max pain:'):
            story.append(CondPageBreak(110))
        story.append(Paragraph(inline(line[4:]),styles['h3'])); i+=1; continue
    if line.startswith('|'):
        block=[]
        while i<len(lines) and lines[i].strip().startswith('|'):
            row=[x.strip() for x in lines[i].strip().strip('|').split('|')]
            if not all(re.fullmatch(r'[:\- ]+',x) for x in row): block.append(row)
            i+=1
        n=len(block[0]); assert all(len(r)==n for r in block), block
        if n==4: widths=[WIDTH*.16,WIDTH*.255,WIDTH*.315,WIDTH*.27]
        elif 'Revenue milestone' in block[0][0]: widths=[WIDTH*.42,WIDTH*.29,WIDTH*.29]
        elif 'Fixed monthly' in block[0][0]: widths=[WIDTH*.54,WIDTH*.23,WIDTH*.23]
        else: widths=[WIDTH*.235,WIDTH*.365,WIDTH*.40]
        cells=[[Paragraph(inline(v),styles['cellhead' if idx==0 else 'cell']) for v in row] for idx,row in enumerate(block)]
        table=LongTable(cells,colWidths=widths,repeatRows=1,hAlign='LEFT',splitByRow=1)
        table.setStyle(TableStyle([
            ('BACKGROUND',(0,0),(-1,0),NAVY),('VALIGN',(0,0),(-1,-1),'TOP'),
            ('LEFTPADDING',(0,0),(-1,-1),8),('RIGHTPADDING',(0,0),(-1,-1),8),
            ('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),8),
            ('ROWBACKGROUNDS',(0,1),(-1,-1),[PALE,colors.white]),
            ('LINEBELOW',(0,0),(-1,0),.6,NAVY),('LINEBELOW',(0,1),(-1,-1),.35,RULE)
        ]))
        story.extend([Spacer(1,5),table,Spacer(1,10)]); table_count+=1; continue
    if line.startswith('- '):
        story.append(Paragraph('&#8226; '+inline(line[2:]),styles['bullet'])); i+=1; continue
    if re.match(r'^\d+\. ',line):
        story.append(Paragraph(inline(line),styles['bullet'])); i+=1; continue
    block=[line]; i+=1
    while i<len(lines) and lines[i].strip() and not lines[i].startswith(('#','|','- ','<!--')) and not re.match(r'^\d+\. ',lines[i]):
        block.append(lines[i].strip()); i+=1
    story.append(Paragraph(inline(' '.join(block)),styles['body']))

doc=ReportDoc(str(OUTPUT),pagesize=(PAGE_W,PAGE_H),rightMargin=49,leftMargin=49,topMargin=61,bottomMargin=59,
    title='Convexa - Quantitative Review and Path to Revenue',author='Research prepared for the Convexa founder',subject='Quant calculations, validation, APIs, competitors and business model')
doc.build(story,onFirstPage=frame,onLaterPages=frame)
reader=PdfReader(OUTPUT)
texts=[p.extract_text() or '' for p in reader.pages]
urls=[]
for p in reader.pages:
    for ref in p.get('/Annots',[]):
        ann=ref.get_object(); action=ann.get('/A')
        if action and action.get('/URI'): urls.append(str(action['/URI']))
for required in ['1. The product','2. Calculation audit','3. Backtesting','4. AI, positions','5. Data APIs','6. Competitors','7. One product','8. Revenue math','9. A 90-day','10. Evidence limits','1,055','2,110','1,216']:
    assert required in '\n'.join(texts),required
assert len(texts)>10
assert len(set(urls))>=25,len(set(urls))
assert all(len(t.strip())>200 for t in texts),[(i+1,len(t)) for i,t in enumerate(texts) if len(t.strip())<=200]
assert '\ufffd' not in '\n'.join(texts)
ledger=[]
for para in re.split(r'\n\s*\n',raw):
    links=LINK_RE.findall(para)
    if links:
        ledger.append({'claim_context':para,'sources':[{'title':t,'url':u,'accessed':'2026-09-05 Pacific / 2026-09-06 UTC','date_note':'See date in claim context; otherwise undated current page'} for t,u in links]})
(ROOT/'claim-source-ledger.json').write_text(json.dumps(ledger,ensure_ascii=False,indent=2),encoding='utf-8')
qa={'pages':len(reader.pages),'word_count':len(raw.split()),'sections':section_count,'tables':table_count,'unique_source_urls':len(set(urls)),
    'source_sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'pdf_sha256':hashlib.sha256(OUTPUT.read_bytes()).hexdigest(),
    'page_char_counts':[len(t) for t in texts],'pdf_bytes':OUTPUT.stat().st_size,'structural_checks':'passed','visual_review':'pending'}
(ROOT/'structural-qa.json').write_text(json.dumps(qa,indent=2),encoding='utf-8')
print(json.dumps(qa,indent=2))
