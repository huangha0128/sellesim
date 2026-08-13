"""
批量生成YYeSim 小程序图标资源
使用 Pillow 绘制清晰的矢量风格图标，输出 PNG 格式
"""
import os
from PIL import Image, ImageDraw, ImageFont

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'apps', 'miniapp', 'static', 'icons')
os.makedirs(OUTPUT_DIR, exist_ok=True)

# 颜色定义
COLORS = {
    'brand': '#0EA5E9',
    'brand_dark': '#0284C7',
    'brand_light': '#E0F2FE',
    'coral': '#FF7A59',
    'coral_light': '#FFF0EB',
    'teal': '#14B8A6',
    'teal_light': '#CCFBF1',
    'sun': '#F59E0B',
    'sun_light': '#FEF3C7',
    'ink': '#0F2B46',
    'ink2': '#5B7A99',
    'ink3': '#8CA3B8',
    'white': '#FFFFFF',
    'gray': '#F1F5F9',
    'gray2': '#E2E8F0',
    'red': '#EF4444',
    'red_light': '#FEE2E2',
    'green': '#10B981',
    'green_light': '#D1FAE5',
}


def get_font(size):
    """获取字体，优先使用系统字体"""
    font_paths = [
        'C:/Windows/Fonts/msyh.ttc',
        'C:/Windows/Fonts/simhei.ttf',
        'C:/Windows/Fonts/arial.ttf',
    ]
    for fp in font_paths:
        if os.path.exists(fp):
            try:
                return ImageFont.truetype(fp, size)
            except:
                pass
    return ImageFont.load_default()


def create_icon(filename, size, draw_func, bg=None):
    """创建图标"""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0) if bg is None else bg)
    draw = ImageDraw.Draw(img)
    draw_func(draw, size)
    path = os.path.join(OUTPUT_DIR, filename)
    img.save(path, 'PNG')
    print(f'  ✓ {filename} ({size}x{size})')
    return path


def create_rect_icon(filename, width, height, draw_func, bg=None):
    """创建矩形图标"""
    img = Image.new('RGBA', (width, height), (0, 0, 0, 0) if bg is None else bg)
    draw = ImageDraw.Draw(img)
    draw_func(draw, width, height)
    path = os.path.join(OUTPUT_DIR, filename)
    img.save(path, 'PNG')
    print(f'  ✓ {filename} ({width}x{height})')
    return path


# ==================== TabBar 图标 ====================
def draw_home(draw, s):
    """首页图标 - 房子"""
    c = COLORS['ink3']
    # 屋顶
    draw.polygon([(s//2, s//8), (s//8, s//2), (s*7//8, s//2)], fill=c)
    # 房体
    draw.rectangle([(s//4, s//2), (s*3//4, s*7//8)], fill=c)
    # 门
    draw.rectangle([(s*2//5, s*3//5), (s*3//5, s*7//8)], fill=COLORS['white'] if c != COLORS['white'] else COLORS['ink3'])

def draw_home_selected(draw, s):
    c = COLORS['brand']
    draw.polygon([(s//2, s//8), (s//8, s//2), (s*7//8, s//2)], fill=c)
    draw.rectangle([(s//4, s//2), (s*3//4, s*7//8)], fill=c)
    draw.rectangle([(s*2//5, s*3//5), (s*3//5, s*7//8)], fill=COLORS['white'])

def draw_esim(draw, s):
    """eSIM 图标 - SIM 卡"""
    c = COLORS['ink3']
    r = s // 10
    # SIM 卡外形（缺角矩形）
    draw.rounded_rectangle([(s//6, s//6), (s*5//6, s*5//6)], radius=r, fill=c)
    # 芯片
    draw.rectangle([(s//3, s//3), (s*2//3, s*2//3)], fill=COLORS['white'] if c != COLORS['white'] else COLORS['ink3'])
    # 芯片线条
    draw.line([(s//3, s//2), (s*2//3, s//2)], fill=c, width=2)
    draw.line([(s//2, s//3), (s//2, s*2//3)], fill=c, width=2)

def draw_esim_selected(draw, s):
    c = COLORS['brand']
    r = s // 10
    draw.rounded_rectangle([(s//6, s//6), (s*5//6, s*5//6)], radius=r, fill=c)
    draw.rectangle([(s//3, s//3), (s*2//3, s*2//3)], fill=COLORS['white'])
    draw.line([(s//3, s//2), (s*2//3, s//2)], fill=c, width=2)
    draw.line([(s//2, s//3), (s//2, s*2//3)], fill=c, width=2)

def draw_profile(draw, s):
    """我的图标 - 人像"""
    c = COLORS['ink3']
    # 头
    draw.ellipse([(s//3, s//6), (s*2//3, s//2)], fill=c)
    # 身体
    draw.ellipse([(s//6, s//2), (s*5//6, s*11//10)], fill=c)

def draw_profile_selected(draw, s):
    c = COLORS['brand']
    draw.ellipse([(s//3, s//6), (s*2//3, s//2)], fill=c)
    draw.ellipse([(s//6, s//2), (s*5//6, s*11//10)], fill=c)


# ==================== 区域图标 ====================
def draw_region_global(draw, s):
    """全球 - 地球"""
    c = COLORS['white']
    cx, cy = s//2, s//2
    r = s//3
    draw.ellipse([(cx-r, cy-r), (cx+r, cy+r)], fill=c, outline=c, width=2)
    # 经纬线
    draw.ellipse([(cx-r//2, cy-r), (cx+r//2, cy+r)], outline=c, width=2)
    draw.line([(cx-r, cy), (cx+r, cy)], fill=c, width=2)
    draw.line([(cx, cy-r), (cx, cy+r)], fill=c, width=2)

def draw_region_asia(draw, s):
    """亚洲 - 东方建筑"""
    c = COLORS['white']
    # 塔顶
    draw.polygon([(s//2, s//6), (s//4, s//3), (s*3//4, s//3)], fill=c)
    # 塔身
    draw.rectangle([(s//3, s//3), (s*2//3, s*2//3)], fill=c)
    # 底座
    draw.rectangle([(s//4, s*2//3), (s*3//4, s*3//4)], fill=c)

def draw_region_europe(draw, s):
    """欧洲 - 城堡"""
    c = COLORS['white']
    # 主体
    draw.rectangle([(s//4, s//3), (s*3//4, s*3//4)], fill=c)
    # 塔楼
    draw.rectangle([(s//5, s//4), (s*2//5, s*3//4)], fill=c)
    draw.rectangle([(s*3//5, s//4), (s*4//5, s*3//4)], fill=c)
    # 屋顶
    draw.polygon([(s//5, s//4), (s*3//10, s//6), (s*2//5, s//4)], fill=c)
    draw.polygon([(s*3//5, s//4), (s*7//10, s//6), (s*4//5, s//4)], fill=c)

def draw_region_americas(draw, s):
    """美洲 - 自由女神像简化"""
    c = COLORS['white']
    # 底座
    draw.rectangle([(s//3, s*2//3), (s*2//3, s*3//4)], fill=c)
    # 身体
    draw.rectangle([(s*2//5, s//3), (s*3//5, s*2//3)], fill=c)
    # 头
    draw.ellipse([(s*2//5, s//5), (s*3//5, s//3)], fill=c)
    # 火炬
    draw.rectangle([(s*3//5, s//6), (s*7//10, s//3)], fill=c)

def draw_region_oceania(draw, s):
    """大洋洲 - 海浪"""
    c = COLORS['white']
    cx, cy = s//2, s//2
    # 波浪
    for i in range(3):
        y = cy - s//6 + i * s//6
        draw.arc([(s//6, y - s//8), (s*5//6, y + s//8)], 0, 180, fill=c, width=3)


# ==================== 首页 Hero 图标 ====================
def draw_brand_logo(draw, s):
    """?? Logo - YY ????"""
    c = COLORS['white']
    # ???
    r = s // 7
    draw.rounded_rectangle([(s//12, s//12), (s*11//12, s*11//12)], radius=r, fill=COLORS['brand'], outline=COLORS['brand_dark'], width=max(2, s//32))
    # YY ??
    font = get_font(int(s * 0.46))
    bbox = draw.textbbox((0, 0), 'YY', font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    x = (s - tw) // 2 - bbox[0]
    y = (s - th) // 2 - bbox[1] + s // 32
    draw.text((x, y), 'YY', font=font, fill=c)


def draw_avatar(draw, s):
    """头像 - 旅行者"""
    c = COLORS['white']
    # 头
    draw.ellipse([(s//3, s//6), (s*2//3, s//2)], fill=c)
    # 身体
    draw.ellipse([(s//6, s//2), (s*5//6, s)], fill=c)
    # 帽子
    draw.rectangle([(s//4, s//8), (s*3//4, s//4)], fill=c)
    draw.rectangle([(s//5, s//5), (s*4//5, s//3)], fill=c)


def draw_airplane(draw, s):
    """飞机"""
    c = COLORS['white']
    # 机身
    draw.polygon([(s//8, s//2), (s*3//4, s//3), (s*7//8, s//2), (s*3//4, s*2//3)], fill=c)
    # 机翼
    draw.polygon([(s//3, s//2), (s//2, s//8), (s*5//8, s//2)], fill=c)
    draw.polygon([(s//3, s//2), (s//2, s*7//8), (s*5//8, s//2)], fill=c)
    # 尾翼
    draw.polygon([(s//8, s//2), (s//5, s//6), (s//4, s//2)], fill=c)


# ==================== 功能图标 ====================
def draw_signal(draw, s):
    """信号"""
    c = COLORS['brand']
    bars = [(s//8, s*3//4, s//6, s//4), (s*3//8, s*3//4, s//6, s//2), (s*5//8, s*3//4, s//6, s//4*3)]
    for x, y, w, h in bars:
        draw.rounded_rectangle([(x, y-h), (x+w, y)], radius=4, fill=c)

def draw_clock(draw, s):
    """时钟"""
    c = COLORS['coral']
    cx, cy = s//2, s//2
    r = s//3
    draw.ellipse([(cx-r, cy-r), (cx+r, cy+r)], outline=c, width=3)
    draw.line([(cx, cy), (cx, cy-r//2)], fill=c, width=3)
    draw.line([(cx, cy), (cx+r//2, cy)], fill=c, width=3)

def draw_shield(draw, s):
    """盾牌"""
    c = COLORS['teal']
    draw.polygon([(s//2, s//8), (s*7//8, s//4), (s*7//8, s//2), (s//2, s*7//8), (s//8, s//2), (s//8, s//4)], fill=c, outline=c, width=2)
    # 勾
    draw.line([(s//3, s//2), (s*2//5, s*3//5), (s*2//3, s//3)], fill=COLORS['white'], width=3)


# ==================== 详情页 benefit 图标 ====================
def draw_lightning(draw, s):
    """闪电"""
    c = COLORS['sun']
    draw.polygon([(s//2, s//12), (s//4, s//2), (s//2, s//2), (s//3, s*11//12), (s*3//4, s//2), (s//2, s//2)], fill=c)

def draw_fire(draw, s):
    """火焰"""
    c = COLORS['coral']
    draw.ellipse([(s//4, s//4), (s*3//4, s*3//4)], fill=c)
    draw.ellipse([(s//3, s//3), (s*2//3, s*2//3)], fill=COLORS['sun'])

def draw_phone(draw, s):
    """手机"""
    c = COLORS['brand']
    r = s // 12
    draw.rounded_rectangle([(s//4, s//8), (s*3//4, s*7//8)], radius=r, fill=c)
    draw.rectangle([(s//3, s//6), (s*2//3, s*5//8)], fill=COLORS['white'])
    draw.ellipse([(s*7//16, s*11//16), (s*9//16, s*13//16)], fill=COLORS['white'])

def draw_shield_small(draw, s):
    """小盾牌"""
    c = COLORS['teal']
    draw.polygon([(s//2, s//8), (s*7//8, s//4), (s*7//8, s//2), (s//2, s*7//8), (s//8, s//2), (s//8, s//4)], fill=c)


# ==================== Profile 页面图标 ====================
def draw_order(draw, s):
    """订单"""
    c = COLORS['brand']
    draw.rounded_rectangle([(s//6, s//6), (s*5//6, s*5//6)], radius=s//12, fill=c)
    draw.line([(s//3, s//3), (s*2//3, s//3)], fill=COLORS['white'], width=3)
    draw.line([(s//3, s//2), (s*2//3, s//2)], fill=COLORS['white'], width=3)
    draw.line([(s//3, s*2//3), (s*3//5, s*2//3)], fill=COLORS['white'], width=3)

def draw_help(draw, s):
    """帮助"""
    c = COLORS['sun']
    draw.ellipse([(s//6, s//6), (s*5//6, s*5//6)], fill=c)
    font = get_font(s//2)
    bbox = draw.textbbox((0, 0), '?', font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    draw.text(((s-tw)//2, (s-th)//2 - bbox[1]), '?', fill=COLORS['white'], font=font)

def draw_settings(draw, s):
    """设置 - 齿轮"""
    c = COLORS['ink3']
    cx, cy = s//2, s//2
    r = s//3
    draw.ellipse([(cx-r, cy-r), (cx+r, cy+r)], fill=c)
    draw.ellipse([(cx-r//2, cy-r//2), (cx+r//2, cy+r//2)], fill=COLORS['white'])
    # 齿
    for angle in range(0, 360, 45):
        import math
        x1 = cx + int(r * math.cos(math.radians(angle)))
        y1 = cy + int(r * math.sin(math.radians(angle)))
        x2 = cx + int((r + s//8) * math.cos(math.radians(angle)))
        y2 = cy + int((r + s//8) * math.sin(math.radians(angle)))
        draw.line([(x1, y1), (x2, y2)], fill=c, width=4)

def draw_about(draw, s):
    """关于"""
    c = COLORS['ink3']
    draw.ellipse([(s//6, s//6), (s*5//6, s*5//6)], fill=c)
    font = get_font(s//3)
    bbox = draw.textbbox((0, 0), 'i', font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    draw.text(((s-tw)//2, (s-th)//2 - bbox[1]), 'i', fill=COLORS['white'], font=font)

def draw_feedback(draw, s):
    """反馈"""
    c = COLORS['brand']
    # 对话气泡
    draw.rounded_rectangle([(s//8, s//6), (s*7//8, s*3//4)], radius=s//8, fill=c)
    draw.polygon([(s//3, s*3//4), (s//2, s*5//6), (s//2, s*3//4)], fill=c)


# ==================== Guide 页面图标 ====================
def draw_apple(draw, s):
    """Apple"""
    c = COLORS['ink']
    # 苹果轮廓
    draw.ellipse([(s//4, s//4), (s*3//4, s*3//4)], fill=c)
    # 叶子
    draw.ellipse([(s//2, s//8), (s*3//5, s//4)], fill=COLORS['green'])

def draw_android(draw, s):
    """Android"""
    c = COLORS['green']
    # 头
    draw.ellipse([(s//4, s//4), (s*3//4, s*3//4)], fill=c)
    # 天线
    draw.line([(s//3, s//4), (s//4, s//8)], fill=c, width=3)
    draw.line([(s*2//3, s//4), (s*3//4, s//8)], fill=c, width=3)
    # 眼睛
    draw.ellipse([(s//3, s//2), (s*2//5, s*3//5)], fill=COLORS['white'])
    draw.ellipse([(s*3//5, s//2), (s*2//3, s*3//5)], fill=COLORS['white'])


# ==================== Checkout 页面图标 ====================
def draw_check_circle(draw, s):
    """勾选圆圈"""
    c = COLORS['green']
    draw.ellipse([(s//8, s//8), (s*7//8, s*7//8)], fill=c)
    draw.line([(s//4, s//2), (s*2//5, s*3//5), (s*3//4, s//3)], fill=COLORS['white'], width=4)

def draw_info_circle(draw, s):
    """信息圆圈"""
    c = COLORS['brand']
    draw.ellipse([(s//8, s//8), (s*7//8, s*7//8)], fill=c)
    font = get_font(s//2)
    bbox = draw.textbbox((0, 0), '!', font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    draw.text(((s-tw)//2, (s-th)//2 - bbox[1]), '!', fill=COLORS['white'], font=font)


# ==================== Esims 页面图标 ====================
def draw_qrcode(draw, s):
    """二维码"""
    c = COLORS['ink']
    m = s // 8
    # 外框
    draw.rectangle([(m, m), (s-m, s-m)], fill=COLORS['white'], outline=c, width=2)
    # 三个定位点
    for x, y in [(m, m), (s-4*m, m), (m, s-4*m)]:
        draw.rectangle([(x, y), (x+2*m, y+2*m)], fill=c)
        draw.rectangle([(x+m//2, y+m//2), (x+3*m//2, y+3*m//2)], fill=COLORS['white'])
    # 随机点
    draw.rectangle([(s//2, s//2), (s//2+m, s//2+m)], fill=c)
    draw.rectangle([(s//2+m, s//2-m), (s//2+2*m, s//2)], fill=c)
    draw.rectangle([(s//2-m, s//2+m), (s//2, s//2+2*m)], fill=c)

def draw_copy(draw, s):
    """复制"""
    c = COLORS['brand']
    draw.rectangle([(s//4, s//4), (s*3//4, s*3//4)], fill=COLORS['white'], outline=c, width=2)
    draw.rectangle([(s//3, s//3), (s*5//6, s*5//6)], fill=COLORS['white'], outline=c, width=2)

def draw_activate(draw, s):
    """激活"""
    c = COLORS['green']
    draw.polygon([(s//2, s//8), (s*7//8, s//2), (s//2, s*7//8), (s//8, s//2)], fill=c)
    draw.line([(s//3, s//2), (s*2//5, s*3//5), (s*2//3, s//3)], fill=COLORS['white'], width=4)

def draw_delete(draw, s):
    """删除"""
    c = COLORS['red']
    draw.ellipse([(s//6, s//6), (s*5//6, s*5//6)], fill=c)
    draw.line([(s//3, s//3), (s*2//3, s*2//3)], fill=COLORS['white'], width=4)
    draw.line([(s*2//3, s//3), (s//3, s*2//3)], fill=COLORS['white'], width=4)


# ==================== Countries 页面图标 ====================
def draw_search(draw, s):
    """搜索"""
    c = COLORS['ink3']
    cx, cy = s//3, s//3
    r = s//4
    draw.ellipse([(cx-r, cy-r), (cx+r, cy+r)], outline=c, width=3)
    draw.line([(cx+r//2, cy+r//2), (s*3//4, s*3//4)], fill=c, width=3)


# ==================== Packages 页面图标 ====================
def draw_filter(draw, s):
    """筛选"""
    c = COLORS['ink3']
    draw.line([(s//8, s//4), (s*7//8, s//4)], fill=c, width=3)
    draw.line([(s//4, s//2), (s*3//4, s//2)], fill=c, width=3)
    draw.line([(s//3, s*3//4), (s*2//3, s*3//4)], fill=c, width=3)


# ==================== 主函数 ====================
def main():
    print('=' * 50)
    print('生成YYeSim 图标资源')
    print('=' * 50)

    # TabBar 图标 (81x81 for 3x retina)
    print('\n TabBar 图标...')
    tab_size = 81
    create_icon('tab-home.png', tab_size, draw_home)
    create_icon('tab-home-active.png', tab_size, draw_home_selected)
    create_icon('tab-esim.png', tab_size, draw_esim)
    create_icon('tab-esim-active.png', tab_size, draw_esim_selected)
    create_icon('tab-profile.png', tab_size, draw_profile)
    create_icon('tab-profile-active.png', tab_size, draw_profile_selected)

    # 区域图标
    print('\n🌍 区域图标...')
    region_size = 96
    create_icon('region-global.png', region_size, draw_region_global, bg=COLORS['brand'])
    create_icon('region-asia.png', region_size, draw_region_asia, bg=COLORS['brand'])
    create_icon('region-europe.png', region_size, draw_region_europe, bg=COLORS['brand'])
    create_icon('region-americas.png', region_size, draw_region_americas, bg=COLORS['brand'])
    create_icon('region-oceania.png', region_size, draw_region_oceania, bg=COLORS['brand'])

    # Hero 图标
    print('\n🎨 Hero 图标...')
    hero_size = 128
    create_icon('hero-logo.png', hero_size, draw_brand_logo)
    create_icon('hero-avatar.png', hero_size, draw_avatar)
    create_icon('hero-airplane.png', 64, draw_airplane)

    # 功能图标
    print('\n⚡ 功能图标...')
    feat_size = 80
    create_icon('feat-signal.png', feat_size, draw_signal)
    create_icon('feat-clock.png', feat_size, draw_clock)
    create_icon('feat-shield.png', feat_size, draw_shield)

    # Benefit 图标 (detail page)
    print('\n🔥 Benefit 图标...')
    ben_size = 80
    create_icon('ben-lightning.png', ben_size, draw_lightning)
    create_icon('ben-fire.png', ben_size, draw_fire)
    create_icon('ben-phone.png', ben_size, draw_phone)
    create_icon('ben-shield.png', ben_size, draw_shield_small)

    # Profile 页面图标
    print('\n👤 Profile 图标...')
    prof_size = 64
    create_icon('prof-order.png', prof_size, draw_order)
    create_icon('prof-help.png', prof_size, draw_help)
    create_icon('prof-settings.png', prof_size, draw_settings)
    create_icon('prof-about.png', prof_size, draw_about)
    create_icon('prof-feedback.png', prof_size, draw_feedback)

    # Guide 页面图标
    print('\n📱 Guide 图标...')
    guide_size = 48
    create_icon('guide-apple.png', guide_size, draw_apple)
    create_icon('guide-android.png', guide_size, draw_android)

    # Checkout 图标
    print('\n🛒 Checkout 图标...')
    co_size = 48
    create_icon('co-check.png', co_size, draw_check_circle)
    create_icon('co-info.png', co_size, draw_info_circle)

    # Esims 页面图标
    print('\n Esims 图标...')
    es_size = 64
    create_icon('esim-qrcode.png', es_size, draw_qrcode)
    create_icon('esim-copy.png', es_size, draw_copy)
    create_icon('esim-activate.png', es_size, draw_activate)
    create_icon('esim-delete.png', es_size, draw_delete)

    # Countries 页面图标
    print('\n🔍 Countries 图标...')
    create_icon('search-icon.png', 48, draw_search)

    # Packages 页面图标
    print('\n📦 Packages 图标...')
    create_icon('filter-icon.png', 48, draw_filter)

    # 国旗图标 (为热门国家生成)
    print('\n🏳️ 国旗图标...')
    flag_size = 64
    
    # 日本 - 白色背景红色圆形
    def draw_flag_jp(draw, s):
        draw.rectangle([(0, 0), (s, s)], fill=COLORS['white'])
        draw.ellipse([(s//4, s//4), (s*3//4, s*3//4)], fill='#BC002D')
    create_icon('flag-jp.png', flag_size, draw_flag_jp)
    
    # 韩国 - 太极旗简化版
    def draw_flag_kr(draw, s):
        draw.rectangle([(0, 0), (s, s//3)], fill=COLORS['white'])
        draw.rectangle([(0, s//3), (s, s*2//3)], fill='#CD2E3A')
        draw.rectangle([(0, s*2//3), (s, s)], fill='#0047A0')
    create_icon('flag-kr.png', flag_size, draw_flag_kr)
    
    # 泰国
    def draw_flag_th(draw, s):
        draw.rectangle([(0, 0), (s, s//5)], fill='#ED1C24')
        draw.rectangle([(0, s//5), (s, s*2//5)], fill=COLORS['white'])
        draw.rectangle([(0, s*2//5), (s, s*3//5)], fill='#241D4F')
        draw.rectangle([(0, s*3//5), (s, s*4//5)], fill=COLORS['white'])
        draw.rectangle([(0, s*4//5), (s, s)], fill='#ED1C24')
    create_icon('flag-th.png', flag_size, draw_flag_th)
    
    # 美国
    def draw_flag_us(draw, s):
        draw.rectangle([(0, 0), (s, s)], fill=COLORS['white'])
        for i in range(7):
            draw.rectangle([(0, i*s//7), (s, (i+1)*s//7)], fill='#B22234' if i % 2 == 0 else COLORS['white'])
        draw.rectangle([(0, 0), (s//2, s//2)], fill='#3C3B6E')
    create_icon('flag-us.png', flag_size, draw_flag_us)
    
    # 新加坡
    def draw_flag_sg(draw, s):
        draw.rectangle([(0, 0), (s, s//2)], fill='#EF3340')
        draw.rectangle([(0, s//2), (s, s)], fill=COLORS['white'])
        draw.ellipse([(s//6, s//6), (s//3, s//3)], fill=COLORS['white'])
    create_icon('flag-sg.png', flag_size, draw_flag_sg)
    
    # 澳大利亚
    def draw_flag_au(draw, s):
        draw.rectangle([(0, 0), (s, s)], fill='#00008B')
        draw.rectangle([(0, 0), (s//2, s//2)], fill='#00008B')
        draw.ellipse([(s//4, s//4), (s//3, s//3)], fill=COLORS['white'])
    create_icon('flag-au.png', flag_size, draw_flag_au)
    
    # 马来西亚
    def draw_flag_my(draw, s):
        for i in range(7):
            draw.rectangle([(0, i*s//7), (s, (i+1)*s//7)], fill='#CC0001' if i % 2 == 0 else COLORS['white'])
        draw.rectangle([(0, 0), (s//2, s//2)], fill='#010066')
        draw.ellipse([(s//6, s//6), (s//3, s//3)], fill='#FFCC00')
    create_icon('flag-my.png', flag_size, draw_flag_my)
    
    # 香港
    def draw_flag_hk(draw, s):
        draw.rectangle([(0, 0), (s, s)], fill='#DE2910')
        draw.ellipse([(s//3, s//3), (s*2//3, s*2//3)], fill=COLORS['white'])
    create_icon('flag-hk.png', flag_size, draw_flag_hk)
    
    # 中国
    def draw_flag_cn(draw, s):
        draw.rectangle([(0, 0), (s, s)], fill='#DE2910')
        draw.ellipse([(s//6, s//6), (s//4, s//4)], fill='#FFDE00')
    create_icon('flag-cn.png', flag_size, draw_flag_cn)
    
    # 台湾
    def draw_flag_tw(draw, s):
        draw.rectangle([(0, 0), (s, s)], fill='#FE0000')
        draw.rectangle([(0, 0), (s//2, s//2)], fill='#000095')
        draw.ellipse([(s//8, s//8), (s//4, s//4)], fill=COLORS['white'])
    create_icon('flag-tw.png', flag_size, draw_flag_tw)
    
    # 澳门
    def draw_flag_mo(draw, s):
        draw.rectangle([(0, 0), (s, s)], fill='#006600')
        draw.ellipse([(s//3, s//4), (s*2//3, s*3//4)], fill=COLORS['white'])
    create_icon('flag-mo.png', flag_size, draw_flag_mo)

    # Profile 页面额外图标
    print('\n Profile 额外图标...')
    prof_size = 64
    
    # eSIM 图标
    def draw_esim_icon(draw, s):
        c = COLORS['brand']
        r = s // 10
        draw.rounded_rectangle([(s//6, s//6), (s*5//6, s*5//6)], radius=r, fill=c)
        draw.rectangle([(s//3, s//3), (s*2//3, s*2//3)], fill=COLORS['white'])
        draw.line([(s//3, s//2), (s*2//3, s//2)], fill=c, width=2)
        draw.line([(s//2, s//3), (s//2, s*2//3)], fill=c, width=2)
    create_icon('prof-esim.png', prof_size, draw_esim_icon)
    
    # 演示图标
    def draw_demo_icon(draw, s):
        c = COLORS['ink3']
        # 屏幕
        draw.rounded_rectangle([(s//8, s//6), (s*7//8, s*5//6)], radius=s//12, fill=c)
        # 支架
        draw.rectangle([(s//3, s*5//6), (s*2//3, s*11//12)], fill=c)
        # 底座
        draw.rectangle([(s//4, s*11//12), (s*3//4, s)], fill=c)
        # 屏幕内容
        draw.rectangle([(s//6, s//4), (s*5//6, s*2//3)], fill=COLORS['white'])
    create_icon('prof-demo.png', prof_size, draw_demo_icon)

    print(f'\n✅ 全部图标已生成到 {OUTPUT_DIR}')
    print(f'   共 {len(os.listdir(OUTPUT_DIR))} 个文件')


if __name__ == '__main__':
    main()