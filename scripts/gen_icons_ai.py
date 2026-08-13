"""
使用 AI 图片生成 API 批量生成高质量图标
API 直接返回 JPEG 图片数据，直接保存即可
"""
import os
import time
import urllib.request
import urllib.parse

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'apps', 'miniapp', 'static', 'icons')
os.makedirs(OUTPUT_DIR, exist_ok=True)

API_BASE = 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image'

ICONS = {
    'tab-home.png': 'minimal flat icon of a house home, simple line art style, dark gray color on white background, mobile app tab bar icon, clean vector style',
    'tab-home-active.png': 'minimal flat icon of a house home, simple line art style, bright sky blue color on white background, mobile app tab bar icon, clean vector style',
    'tab-esim.png': 'minimal flat icon of a SIM card chip, simple line art style, dark gray color on white background, mobile app tab bar icon, clean vector style',
    'tab-esim-active.png': 'minimal flat icon of a SIM card chip, simple line art style, bright sky blue color on white background, mobile app tab bar icon, clean vector style',
    'tab-profile.png': 'minimal flat icon of a person user profile avatar, simple line art style, dark gray color on white background, mobile app tab bar icon, clean vector style',
    'tab-profile-active.png': 'minimal flat icon of a person user profile avatar, simple line art style, bright sky blue color on white background, mobile app tab bar icon, clean vector style',
    'region-global.png': 'flat design icon of a globe earth world map, blue background, white symbol, simple clean vector style',
    'region-asia.png': 'flat design icon of Asia map silhouette, blue background, white symbol, simple clean vector style',
    'region-europe.png': 'flat design icon of Europe map silhouette, blue background, white symbol, simple clean vector style',
    'region-americas.png': 'flat design icon of Americas map silhouette, blue background, white symbol, simple clean vector style',
    'region-oceania.png': 'flat design icon of Oceania Australia map silhouette, blue background, white symbol, simple clean vector style',
    'hero-logo.png': 'minimal flat app icon of two bold capital letters YY in white on a rounded bright sky blue background, clean vector logo style',
    'hero-avatar.png': 'cute cartoon traveler person avatar with hat, friendly smiling, blue color scheme, white background, simple flat design, app icon style',
    'hero-airplane.png': 'minimal flat icon of an airplane, simple line art style, white color on blue background, clean vector style',
    'feat-signal.png': 'minimal flat icon of signal bars wifi strength, simple line art style, blue color on white background, clean vector style',
    'feat-clock.png': 'minimal flat icon of a clock time, simple line art style, coral orange color on white background, clean vector style',
    'feat-shield.png': 'minimal flat icon of a shield security checkmark, simple line art style, teal green color on white background, clean vector style',
    'ben-lightning.png': 'minimal flat icon of a lightning bolt fast, simple line art style, yellow color on white background, clean vector style',
    'ben-fire.png': 'minimal flat icon of a flame fire hot, simple line art style, coral orange color on white background, clean vector style',
    'ben-phone.png': 'minimal flat icon of a mobile phone device, simple line art style, blue color on white background, clean vector style',
    'ben-shield.png': 'minimal flat icon of a shield protection, simple line art style, teal green color on white background, clean vector style',
    'prof-esim.png': 'minimal flat icon of a SIM card eSIM, simple line art style, blue color on white background, clean vector style',
    'prof-order.png': 'minimal flat icon of a receipt order document, simple line art style, blue color on white background, clean vector style',
    'prof-help.png': 'minimal flat icon of a question mark help circle, simple line art style, yellow color on white background, clean vector style',
    'prof-settings.png': 'minimal flat icon of a gear settings, simple line art style, gray color on white background, clean vector style',
    'prof-about.png': 'minimal flat icon of an information circle, simple line art style, gray color on white background, clean vector style',
    'prof-feedback.png': 'minimal flat icon of a chat bubble feedback, simple line art style, blue color on white background, clean vector style',
    'prof-demo.png': 'minimal flat icon of a computer monitor screen, simple line art style, gray color on white background, clean vector style',
    'guide-apple.png': 'minimal flat icon of an Apple logo, simple line art style, dark color on white background, clean vector style',
    'guide-android.png': 'minimal flat icon of an Android robot logo, simple line art style, green color on white background, clean vector style',
    'co-check.png': 'minimal flat icon of a checkmark circle success, simple line art style, green color on white background, clean vector style',
    'co-info.png': 'minimal flat icon of an information circle, simple line art style, blue color on white background, clean vector style',
    'esim-qrcode.png': 'minimal flat icon of a QR code, simple line art style, dark color on white background, clean vector style',
    'esim-copy.png': 'minimal flat icon of a copy duplicate document, simple line art style, blue color on white background, clean vector style',
    'esim-activate.png': 'minimal flat icon of a power activate button, simple line art style, green color on white background, clean vector style',
    'esim-delete.png': 'minimal flat icon of a trash can delete, simple line art style, red color on white background, clean vector style',
    'search-icon.png': 'minimal flat icon of a magnifying glass search, simple line art style, gray color on white background, clean vector style',
    'filter-icon.png': 'minimal flat icon of a filter funnel, simple line art style, gray color on white background, clean vector style',
    'flag-jp.png': 'Japan flag icon, simple flat design, white background with red circle',
    'flag-kr.png': 'South Korea flag icon, simple flat design, white background with red and blue yin-yang symbol',
    'flag-th.png': 'Thailand flag icon, simple flat design, red white blue horizontal stripes',
    'flag-us.png': 'United States flag icon, simple flat design, stars and stripes',
    'flag-sg.png': 'Singapore flag icon, simple flat design, red and white with crescent moon and stars',
    'flag-au.png': 'Australia flag icon, simple flat design, blue background with Southern Cross stars',
    'flag-my.png': 'Malaysia flag icon, simple flat design, red white stripes with blue canton and crescent',
    'flag-hk.png': 'Hong Kong flag icon, simple flat design, red background with white bauhinia flower',
    'flag-cn.png': 'China flag icon, simple flat design, red background with yellow stars',
    'flag-tw.png': 'Taiwan flag icon, simple flat design, red background with blue canton and white sun',
    'flag-mo.png': 'Macau flag icon, simple flat design, green background with white lotus flower',
    'flag-id.png': 'Indonesia flag icon, simple flat design, red and white horizontal stripes',
    'flag-vn.png': 'Vietnam flag icon, simple flat design, red background with yellow star',
    'flag-ph.png': 'Philippines flag icon, simple flat design, blue and red with white triangle and sun',
    'flag-in.png': 'India flag icon, simple flat design, orange white green stripes with blue wheel',
    'flag-lk.png': 'Sri Lanka flag icon, simple flat design, maroon background with yellow lion',
    'flag-mv.png': 'Maldives flag icon, simple flat design, green background with red crescent',
    'flag-ae.png': 'UAE flag icon, simple flat design, red white black green stripes',
    'flag-tr.png': 'Turkey flag icon, simple flat design, red background with white crescent and star',
    'flag-gb.png': 'United Kingdom flag icon, simple flat design, blue with red and white crosses',
    'flag-fr.png': 'France flag icon, simple flat design, blue white red vertical stripes',
    'flag-it.png': 'Italy flag icon, simple flat design, green white red vertical stripes',
    'flag-de.png': 'Germany flag icon, simple flat design, black red gold horizontal stripes',
    'flag-es.png': 'Spain flag icon, simple flat design, red yellow red horizontal stripes',
    'flag-gr.png': 'Greece flag icon, simple flat design, blue and white stripes with cross',
    'flag-ch.png': 'Switzerland flag icon, simple flat design, red background with white cross',
    'flag-nl.png': 'Netherlands flag icon, simple flat design, red white blue horizontal stripes',
    'flag-pt.png': 'Portugal flag icon, simple flat design, green and red with coat of arms',
    'flag-ru.png': 'Russia flag icon, simple flat design, white blue red horizontal stripes',
    'flag-ca.png': 'Canada flag icon, simple flat design, red white red with maple leaf',
    'flag-mx.png': 'Mexico flag icon, simple flat design, green white red with eagle emblem',
    'flag-br.png': 'Brazil flag icon, simple flat design, green background with yellow diamond',
    'flag-ar.png': 'Argentina flag icon, simple flat design, light blue white light blue stripes',
    'flag-nz.png': 'New Zealand flag icon, simple flat design, blue background with red stars',
    'flag-eg.png': 'Egypt flag icon, simple flat design, red white black stripes with eagle',
    'flag-za.png': 'South Africa flag icon, simple flat design, colorful Y shape design',
    'flag-ma.png': 'Morocco flag icon, simple flat design, red background with green star',
    'flag-eu.png': 'European Union flag icon, simple flat design, blue background with circle of yellow stars',
}


def generate_icon(filename, prompt):
    """通过 AI API 生成图标，API 直接返回 JPEG 图片数据"""
    output_path = os.path.join(OUTPUT_DIR, filename)
    encoded_prompt = urllib.parse.quote(prompt)
    api_url = f"{API_BASE}?prompt={encoded_prompt}&image_size=square"

    try:
        print(f'  生成 {filename}...', flush=True)
        req = urllib.request.Request(api_url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        with urllib.request.urlopen(req, timeout=60) as resp:
            img_data = resp.read()
        with open(output_path, 'wb') as f:
            f.write(img_data)
        size_kb = len(img_data) / 1024
        print(f'  ✓ {filename} ({size_kb:.1f} KB)')
        return True
    except Exception as e:
        print(f'  ✗ {filename}: {e}')
        return False


def main():
    print('=' * 50)
    print('使用 AI 生成高质量图标')
    print('=' * 50)

    total = len(ICONS)
    success = 0
    failed = 0

    for i, (filename, prompt) in enumerate(ICONS.items(), 1):
        print(f'\n[{i}/{total}]')
        if generate_icon(filename, prompt):
            success += 1
        else:
            failed += 1
        time.sleep(1)

    print(f'\n{"=" * 50}')
    print(f'生成完成: {success} 成功, {failed} 失败')
    print(f'输出目录: {OUTPUT_DIR}')


if __name__ == '__main__':
    main()
