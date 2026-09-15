export interface Country {
  code: string;
  name: string;
  en: string;
  flag: string;
  cat: string;
  priority: number;
  hot: number;
  packageCount: number;
}

export interface MinPrice {
  code: string;
  currency: string;
  minPrice: number;
}

export interface CountriesResp {
  code: number;
  data: { countries: Country[] };
}

export interface MinPricesResp {
  code: number;
  data: { minPrices: MinPrice[] };
}

/** 套餐视图（来源 TigerESIM 实时，经 tigerToView 归一化） */
export interface PackageView {
  id: string;
  countryCode: string;
  countryName: string;
  countryNameEn: string;
  gb: number;
  days: number;
  price: number;
  isUnlimited: boolean;
  name: string;
  nameEn: string;
  type: string;
  network: string;
  speed: string;
  speedEn: string;
  coverage: string;
  desc: string;
  descEn: string;
  tag: string;
  tagColor: string;
  isFeatured: boolean;
  tigerPkgId: number;
  tigerPid: string;
  features: string[];
  installSteps: string[];
  soldCount?: number;
}

export interface PackagesResp {
  code: number;
  message?: string;
  data?: { packages: PackageView[] };
}

export interface PackageResp {
  code: number;
  message?: string;
  data?: { pkg: PackageView };
}