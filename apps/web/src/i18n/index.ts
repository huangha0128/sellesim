import { computed, reactive } from 'vue';
import zh from './zh';
import en from './en';

type Dict = typeof zh;
type Lang = 'zh' | 'en';

const dict: Record<Lang, Dict> = { zh, en };

function load(): Lang {
  const saved = localStorage.getItem('web-lang');
  if (saved === 'zh' || saved === 'en') return saved;
  return (navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

const state = reactive<{ current: Lang }>({ current: load() });
const current = computed(() => state.current);

function setLang(l: Lang) {
  state.current = l;
  localStorage.setItem('web-lang', l);
}

/** 解析形如 'a.b.c' 的路径，返回原始值（字符串/数组合法） */
function resolveRaw(key: string): unknown {
  let obj: unknown = dict[state.current];
  for (const seg of key.split('.')) {
    if (obj == null) return key;
    obj = (obj as Record<string, unknown>)[seg];
  }
  return obj;
}

/** 字符串插值：取到字符串后做 {var} 替换；非字符串则原样返回（如数组用于列表渲染） */
function resolve(key: string, vars?: Record<string, string | number>): string {
  const val = resolveRaw(key);
  let text = typeof val === 'string' ? val : key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(`{${k}}`, String(v));
    }
  }
  return text;
}

export function useI18n() {
  return {
    current,
    setLang,
    t: (k: string, vars?: Record<string, string | number>) => resolve(k, vars),
    tr: (k: string) => resolveRaw(k),
  };
}

export { resolve as t, resolveRaw as tr };