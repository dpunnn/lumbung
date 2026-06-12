# -*- coding: utf-8 -*-
"""Generate mockup layar LUMBUNG (PNG) untuk diimpor ke Figma."""
from PIL import Image, ImageDraw, ImageFont
import os

OUT = os.path.dirname(os.path.abspath(__file__))
W, H = 440, 920
NAVY = (31, 56, 100)
NAVY2 = (45, 78, 135)
BG = (240, 243, 248)
CARD = (255, 255, 255)
LINE = (222, 227, 235)
GREY = (120, 130, 145)
GREEN = (32, 160, 110)
AMBER = (218, 150, 40)
RED = (200, 70, 70)
TEXTD = (33, 41, 54)

def F(sz, bold=False):
    p = r"C:\Windows\Fonts\\" + ("arialbd.ttf" if bold else "arial.ttf")
    return ImageFont.truetype(p, sz)

def rr(d, xy, r, fill=None, outline=None, width=1):
    d.rounded_rectangle(xy, radius=r, fill=fill, outline=outline, width=width)

def base(title, sub):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    # phone frame
    rr(d, (10, 10, W-10, H-10), 28, fill=CARD, outline=(210,215,224), width=2)
    # header
    rr(d, (10, 10, W-10, 96), 28, fill=NAVY)
    d.rectangle((10, 60, W-10, 96), fill=NAVY)
    d.text((30, 30), "LUMBUNG", font=F(20, True), fill=(255,255,255))
    d.text((30, 60), title, font=F(13, True), fill=(190, 205, 230))
    return img, d

def chip(d, x, y, text, color):
    w = d.textlength(text, font=F(11, True)) + 22
    rr(d, (x, y, x+w, y+22), 11, fill=color)
    d.text((x+11, y+5), text, font=F(11, True), fill=(255,255,255))
    return w

def card(d, x, y, w, h):
    rr(d, (x, y, x+w, y+h), 14, fill=CARD, outline=LINE, width=1)

def navbar(d):
    y = H-66
    d.rectangle((11, y, W-11, H-12), fill=(248,250,252))
    items = ["Beranda","Ternak","Pass","Laporan"]
    for i,t in enumerate(items):
        cx = 11 + (W-22)*(i+0.5)/4
        c = NAVY if i==0 else GREY
        d.ellipse((cx-4, y+14, cx+4, y+22), fill=c)
        w = d.textlength(t, font=F(10, True))
        d.text((cx-w/2, y+28), t, font=F(10, True), fill=c)

# ---------- 1. Dashboard Pengurus ----------
img, d = base("Beranda Pengurus — Koperasi Harapan Baru", "")
chip(d, 30, 110, "● Offline — tersimpan, sinkron saat sinyal kembali", AMBER)
card(d, 30, 150, 175, 90); d.text((46,166),"Ternak aktif",font=F(12),fill=GREY); d.text((46,186),"248",font=F(30,True),fill=NAVY); d.text((46,224),"ekor",font=F(11),fill=GREY)
card(d, 235, 150, 175, 90); d.text((251,166),"Indeks kesehatan",font=F(12),fill=GREY); d.text((251,186),"Baik",font=F(26,True),fill=GREEN); d.text((251,224),"AI Insight",font=F(11),fill=GREY)
card(d, 30, 252, 380, 88); d.text((46,268),"Simpanan anggota",font=F(12),fill=GREY); d.text((46,288),"Rp 142.350.000",font=F(24,True),fill=NAVY); d.text((46,320),"▲ 3,1% bulan ini",font=F(11,True),fill=GREEN)
card(d, 30, 352, 380, 96)
d.text((46,366),"Peringatan dini (AI)",font=F(12,True),fill=TEXTD)
d.ellipse((46,392,56,402),fill=AMBER); d.text((66,390),"Stok pakan turun 12% — pesan ulang",font=F(12),fill=TEXTD)
d.ellipse((46,416,56,426),fill=RED); d.text((66,414),"3 ekor ternak perlu vaksin minggu ini",font=F(12),fill=TEXTD)
card(d, 30, 460, 380, 120)
d.text((46,474),"Aksi cepat",font=F(12,True),fill=TEXTD)
for i,t in enumerate(["+ Catat ternak","+ Simpan/pinjam","+ Terima pakan","Terbitkan Pass"]):
    bx = 46 + (i%2)*185; by = 500 + (i//2)*38
    rr(d,(bx,by,bx+170,by+30),8,fill=(238,242,248),outline=LINE,width=1)
    d.text((bx+14,by+8),t,font=F(12,True),fill=NAVY)
navbar(d)
img.save(os.path.join(OUT,"01_dashboard.png"))

# ---------- 2. Lumbung Pass ----------
img, d = base("Lumbung Pass — Terbitkan Paspor Data", "")
card(d, 30, 116, 380, 70); d.text((46,130),"Permintaan dari mitra",font=F(11),fill=GREY); d.text((46,150),"BPR Sejahtera — kelayakan kredit Rp50jt",font=F(13,True),fill=TEXTD)
d.text((30,200),"Data yang akan dibagikan (minim & agregat)",font=F(12,True),fill=TEXTD)
rows=[("Rasio simpanan–pinjaman",True),("Indeks kesehatan & jumlah ternak",True),("Riwayat arus kas (agregat)",True),("Identitas anggota",False),("Rincian transaksi per anggota",False)]
y=224
for t,on in rows:
    card(d,30,y,380,40)
    d.text((46,y+11),t,font=F(12),fill=TEXTD)
    col=GREEN if on else (205,210,218)
    rr(d,(366,y+9,398,y+31),11,fill=col)
    knob = 384 if on else 370
    d.ellipse((knob,y+11,knob+18,y+29),fill=(255,255,255))
    y+=48
card(d,30,y+6,380,72)
d.text((46,y+18),"Pengaman aktif",font=F(11,True),fill=TEXTD)
for i,t in enumerate(["Atas persetujuan","Terverifikasi (hash)","Berlaku 30 hari","Teraudit"]):
    bx=46+(i%2)*185; by=y+38+(i//2)*0
    cx=46+(i%2)*185; cy=y+38+(i//2)*20
    d.text((cx,cy),"✓ "+t,font=F(11),fill=GREEN)
yy=y+86
rr(d,(30,yy,410,yy+46),12,fill=NAVY)
d.text((150,yy+14),"Terbitkan Paspor Data",font=F(14,True),fill=(255,255,255))
navbar(d)
img.save(os.path.join(OUT,"02_lumbung_pass.png"))

# ---------- 3. Lumbung Lens ----------
img, d = base("Lumbung Lens — Laporan Adaptif", "")
card(d,30,116,380,96)
d.text((46,130),"Ringkasan bahasa sederhana",font=F(12,True),fill=TEXTD)
d.text((46,152),"Bulan ini stok pakan turun 12%, simpanan",font=F(12),fill=TEXTD)
d.text((46,170),"anggota naik Rp4,2 juta, dan 3 ekor ternak",font=F(12),fill=TEXTD)
d.text((46,188),"perlu vaksin.",font=F(12),fill=TEXTD)
card(d,30,226,380,150)
d.text((46,240),"Perkembangan simpanan (6 bulan)",font=F(12,True),fill=TEXTD)
vals=[40,55,52,68,75,88]
bx=56
for i,v in enumerate(vals):
    h=v*1.1
    rr(d,(bx, 360-h, bx+38, 360),6,fill=NAVY2)
    d.text((bx+8,364),["Jan","Feb","Mar","Apr","Mei","Jun"][i],font=F(10),fill=GREY)
    bx+=58
card(d,30,392,380,150)
d.text((46,406),"Kesehatan ternak",font=F(12,True),fill=TEXTD)
segs=[("Sehat",70,GREEN),("Pantau",22,AMBER),("Sakit",8,RED)]
x=46
for t,p,c in segs:
    w=p*3.4
    rr(d,(x,430,x+w,452),6,fill=c); x+=w+6
y2=470
for t,p,c in segs:
    d.ellipse((46,y2,58,y2+12),fill=c); d.text((66,y2-2),f"{t} — {p}%",font=F(12),fill=TEXTD); y2+=24
navbar(d)
img.save(os.path.join(OUT,"03_lumbung_lens.png"))

# ---------- 4. Lumbung Atlas ----------
img, d = base("Lumbung Atlas — Dasbor Pemerintah Kabupaten", "")
chip(d,30,110,"Privacy-preserving — data agregat, identitas terjaga",GREEN)
cards=[("Koperasi aktif","5"),("Total anggota","1.180"),("Kredit tersalur","Rp 640 jt"),("Ketahanan stok","Stabil")]
for i,(t,v) in enumerate(cards):
    x=30+(i%2)*195; y=150+(i//2)*96
    card(d,x,y,180,84)
    d.text((x+16,y+14),t,font=F(11),fill=GREY)
    d.text((x+16,y+36),v,font=F(22,True),fill=NAVY)
card(d,30,348,380,210)
d.text((46,362),"Kesehatan usaha per koperasi",font=F(12,True),fill=TEXTD)
data=[("Harapan Baru",86,GREEN),("Melati Jaya",78,GREEN),("Padiwangi",64,AMBER),("Sumber Makmur",59,AMBER),("Tirta Bersama",47,RED)]
y=392
for name,v,c in data:
    d.text((46,y),name,font=F(12),fill=TEXTD)
    rr(d,(190,y+2,190+v*2,y+16),7,fill=c)
    d.text((190+v*2+8,y),str(v),font=F(11,True),fill=GREY)
    y+=32
navbar(d)
img.save(os.path.join(OUT,"04_lumbung_atlas.png"))

print("OK ->", OUT)
print(os.listdir(OUT))
