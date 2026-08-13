#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从 flagcdn.com 下载国旗图标
使用免费的国旗图标 CDN
"""
import os
import urllib.request
from pathlib import Path

OUTPUT_DIR = Path(__file__).parent.parent / 'apps' / 'miniapp' / 'static' / 'icons'
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# 国家代码列表（来自 mock/data.js）
COUNTRIES = [
    'jp', 'kr', 'th', 'sg', 'my', 'id', 'vn', 'ph', 'hk', 'mo', 'tw',
    'in', 'lk', 'mv', 'ae', 'tr', 'gb', 'fr', 'it', 'de', 'es', 'gr',
    'ch', 'nl', 'pt', 'ru', 'us', 'ca', 'mx', 'br', 'ar', 'au', 'nz',
    'eg', 'za', 'ma'
]

# 区域代码
REGIONS = {
    'global': 'un',  # 联合国旗帜代表全球
    'asia': 'as',
    'europe': 'eu',
    'americas': 'na',
    'oceania': 'oc'
}

def download_flag(code, output_name=None):
    """下载国旗图标"""
    if output_name is None:
        output_name = f'flag-{code}.png'
    
    output_path = OUTPUT_DIR / output_name
    
    # 使用 flagcdn.com 的 API
    url = f'https://flagcdn.com/64x48/{code}.png'
    
    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = resp.read()
            with open(output_path, 'wb') as f:
                f.write(data)
        print(f'✓ {output_name} ({len(data)} bytes)')
        return True
    except Exception as e:
        print(f'✗ {output_name}: {e}')
        return False

def main():
    print('=' * 50)
    print('下载国旗图标')
    print('=' * 50)
    
    success = 0
    failed = 0
    
    # 下载国家国旗
    print('\n下载国家国旗...')
    for code in COUNTRIES:
        if download_flag(code):
            success += 1
        else:
            failed += 1
    
    # 下载区域旗帜
    print('\n下载区域旗帜...')
    for region, code in REGIONS.items():
        if download_flag(code, f'flag-{region}.png'):
            success += 1
        else:
            failed += 1
    
    print(f'\n{"=" * 50}')
    print(f'下载完成: {success} 成功, {failed} 失败')
    print(f'输出目录: {OUTPUT_DIR}')

if __name__ == '__main__':
    main()
