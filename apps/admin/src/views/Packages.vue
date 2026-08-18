<template>
  <div>
    <el-card style="margin-bottom: 16px;">
      <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
        <el-input v-model="query.keyword" placeholder="关键词 / 国家 / 描述" clearable style="width: 240px;" @keyup.enter="load" @clear="load" />
        <el-input v-model="query.countryCode" placeholder="国家代码 如 JP" clearable style="width: 160px;" @keyup.enter="load" @clear="load" />
        <el-switch v-model="query.onlyFeatured" active-text="仅显示精选" @change="load" />
        <el-button type="primary" @click="load">搜索</el-button>
        <el-button type="primary" plain @click="openAdd">添加套餐</el-button>
        <el-button type="success" @click="syncFromTiger" :loading="syncing">从 Tiger 导入</el-button>
      </div>
    </el-card>
    <el-card>
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 700;">套餐列表</span>
          <el-button type="primary" @click="openAdd">
            <el-icon><Plus /></el-icon> 添加套餐
          </el-button>
        </div>
      </template>
      <el-table :data="packages" stripe>
        <el-table-column label="国家" width="160">
          <template #default="{ row }">
            <div style="display: flex; align-items: center; gap: 6px;">
              <img v-if="row.country?.flag" :src="row.country.flag" :alt="row.country?.name" style="width: 24px; height: 16px; object-fit: cover; border-radius: 2px;" />
              <span>{{ row.country?.name }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="gb" label="流量" width="80">
          <template #default="{ row }">{{ row.gb }}GB</template>
        </el-table-column>
        <el-table-column prop="days" label="有效期" width="80">
          <template #default="{ row }">{{ row.days }}天</template>
        </el-table-column>
        <el-table-column prop="price" label="价格" width="100">
          <template #default="{ row }">¥{{ row.price }}</template>
        </el-table-column>
        <el-table-column prop="type" label="类型" width="100" />
        <el-table-column prop="tag" label="标签" width="80">
          <template #default="{ row }">
            <el-tag v-if="row.tag" size="small" :color="row.tagColor" style="color: #fff;">{{ row.tag }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="network" label="网络" width="100" />
        <el-table-column label="Tiger ID" width="100">
          <template #default="{ row }">
            <span v-if="row.tigerPkgId">{{ row.tigerPkgId }}</span>
            <el-tag v-else size="small" type="info">未关联</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="editPkg(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="deletePkg(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div style="display:flex;justify-content:flex-end;margin-top:16px;">
        <el-pagination
          v-model:current-page="page"
          :page-size="pageSize"
          :total="total"
          layout="total, prev, pager, next, sizes"
          :page-sizes="[10, 20, 50, 100]"
          @current-change="load"
          @size-change="onSizeChange"
        />
      </div>
    </el-card>

    <el-dialog v-model="showAdd" :title="editing ? '编辑套餐' : '添加套餐'" width="650px" @open="onDialogOpen">
      <el-form :model="form" label-width="110px">
        <el-divider content-position="left">基础信息</el-divider>
        <el-form-item label="国家代码" required>
          <el-input v-model="form.countryCode" :disabled="!!editing" placeholder="如 JP, US, GLOBAL" />
        </el-form-item>
        <el-form-item label="流量 (GB)" required>
          <el-input-number v-model="form.gb" :min="1" :max="1000" />
        </el-form-item>
        <el-form-item label="有效期 (天)" required>
          <el-input-number v-model="form.days" :min="1" :max="365" />
        </el-form-item>
        <el-form-item label="价格 (¥)" required>
          <el-input-number v-model="form.price" :min="0" :precision="2" :step="0.1" />
        </el-form-item>
        <el-form-item label="是否精选">
          <el-switch v-model="form.isFeatured" />
        </el-form-item>

        <el-divider content-position="left">套餐详情</el-divider>
        <el-form-item label="套餐名称">
          <el-input v-model="form.name" placeholder="套餐显示名称" />
        </el-form-item>
        <el-form-item label="套餐类型">
          <el-select v-model="form.type" style="width: 100%;">
            <el-option label="本地套餐" value="本地套餐" />
            <el-option label="多国通用" value="多国通用" />
            <el-option label="区域套餐" value="区域套餐" />
          </el-select>
        </el-form-item>
        <el-form-item label="网络类型">
          <el-input v-model="form.network" placeholder="如 4G/5G" />
        </el-form-item>
        <el-form-item label="速度描述">
          <el-input v-model="form.speed" placeholder="如 高速" />
        </el-form-item>
        <el-form-item label="覆盖范围">
          <el-input v-model="form.coverage" placeholder="如 日本覆盖" />
        </el-form-item>
        <el-form-item label="套餐描述">
          <el-input v-model="form.desc" type="textarea" :rows="2" placeholder="套餐详细描述" />
        </el-form-item>

        <el-divider content-position="left">标签与特性</el-divider>
        <el-form-item label="标签">
          <el-input v-model="form.tag" placeholder="如 热门、推荐" />
        </el-form-item>
        <el-form-item label="标签颜色">
          <el-color-picker v-model="form.tagColor" />
        </el-form-item>
        <el-form-item label="特性列表">
          <el-input v-model="form.features" type="textarea" :rows="2" placeholder='JSON 数组格式，如 ["特性1","特性2"]' />
        </el-form-item>
        <el-form-item label="安装步骤">
          <el-input v-model="form.installSteps" type="textarea" :rows="2" placeholder='JSON 数组格式，如 ["步骤1","步骤2"]' />
        </el-form-item>

        <el-divider content-position="left">Tiger 关联</el-divider>
        <el-form-item label="Tiger 套餐 ID">
          <el-input-number v-model="form.tigerPkgId" :min="0" placeholder="Tiger 系统中的套餐 ID" style="width: 100%;" />
        </el-form-item>
        <el-form-item label="Tiger PID">
          <el-input v-model="form.tigerPid" placeholder="Tiger 系统中的产品 ID" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAdd = false">取消</el-button>
        <el-button type="primary" @click="savePkg" :loading="saving">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { adminApi } from '../api';

const packages = ref([]);
const showAdd = ref(false);
const editing = ref(null);
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);
const syncing = ref(false);
const saving = ref(false);
const query = ref({ keyword: '', countryCode: '', onlyFeatured: false });

const defaultForm = () => ({
  countryCode: '',
  gb: 1,
  days: 7,
  price: 0,
  name: '',
  type: '本地套餐',
  network: '4G/5G',
  speed: '高速',
  coverage: '',
  tag: '',
  tagColor: '',
  desc: '',
  isFeatured: false,
  features: '[]',
  installSteps: '[]',
  tigerPkgId: null as number | null,
  tigerPid: '',
});

const form = ref(defaultForm());

const openAdd = () => {
  editing.value = null;
  form.value = defaultForm();
  showAdd.value = true;
};

const onDialogOpen = () => {
  if (!editing.value) {
    form.value = defaultForm();
  }
};

const load = async () => {
  const params: any = {
    page: page.value,
    pageSize: pageSize.value,
  };
  if (query.value.keyword) params.keyword = query.value.keyword;
  if (query.value.countryCode) params.countryCode = query.value.countryCode;
  if (query.value.onlyFeatured) params.featured = '1';
  const res = await adminApi.getPackagesPage(params);
  packages.value = res.data.data.packages || [];
  total.value = res.data.data.total || 0;
};

const onSizeChange = (size: number) => {
  pageSize.value = size;
  page.value = 1;
  load();
};

const editPkg = (row) => {
  editing.value = row;
  form.value = {
    countryCode: row.countryCode || '',
    gb: row.gb || 1,
    days: row.days || 7,
    price: row.price || 0,
    name: row.name || '',
    type: row.type || '本地套餐',
    network: row.network || '4G/5G',
    speed: row.speed || '高速',
    coverage: row.coverage || '',
    tag: row.tag || '',
    tagColor: row.tagColor || '',
    desc: row.desc || '',
    isFeatured: row.isFeatured || false,
    features: row.features || '[]',
    installSteps: row.installSteps || '[]',
    tigerPkgId: row.tigerPkgId || null,
    tigerPid: row.tigerPid || '',
  };
  showAdd.value = true;
};

const validateForm = () => {
  if (!form.value.countryCode) {
    ElMessage.warning('请输入国家代码');
    return false;
  }
  if (form.value.gb < 1) {
    ElMessage.warning('流量必须大于 0');
    return false;
  }
  if (form.value.days < 1) {
    ElMessage.warning('有效期必须大于 0');
    return false;
  }
  if (form.value.price < 0) {
    ElMessage.warning('价格不能为负数');
    return false;
  }
  // 验证 JSON 格式
  try {
    JSON.parse(form.value.features);
    JSON.parse(form.value.installSteps);
  } catch {
    ElMessage.warning('特性列表和安装步骤必须是有效的 JSON 数组格式');
    return false;
  }
  return true;
};

const savePkg = async () => {
  if (!validateForm()) return;
  
  saving.value = true;
  try {
    const data = {
      countryCode: form.value.countryCode,
      gb: form.value.gb,
      days: form.value.days,
      price: form.value.price,
      name: form.value.name || `${form.value.countryCode} ${form.value.gb}GB/${form.value.days}天`,
      type: form.value.type,
      network: form.value.network,
      speed: form.value.speed,
      coverage: form.value.coverage || `${form.value.countryCode}覆盖`,
      tag: form.value.tag || '',
      tagColor: form.value.tagColor || '',
      desc: form.value.desc || `${form.value.gb}GB 流量，${form.value.days} 天有效`,
      isFeatured: form.value.isFeatured,
      features: form.value.features,
      installSteps: form.value.installSteps,
      tigerPkgId: form.value.tigerPkgId,
      tigerPid: form.value.tigerPid || '',
    };
    if (editing.value) {
      await adminApi.updatePackage(editing.value.id, data);
    } else {
      await adminApi.createPackage(data);
    }
    ElMessage.success('保存成功');
    showAdd.value = false;
    editing.value = null;
    load();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '保存失败');
  } finally {
    saving.value = false;
  }
};

const deletePkg = async (id) => {
  await ElMessageBox.confirm('确定删除该套餐？', '警告', { type: 'warning' });
  await adminApi.deletePackage(id);
  ElMessage.success('已删除');
  load();
};

const syncFromTiger = async () => {
  syncing.value = true;
  try {
    const res = await adminApi.syncTigerPackages();
    if (res.data.code === 0) {
      const { matched, total, tigerTotal } = res.data.data;
      ElMessage.success(`同步成功：Tiger 共 ${tigerTotal} 个套餐，本地匹配 ${matched} 个，总计 ${total} 个`);
      load();
    } else {
      ElMessage.error(res.data.message || '同步失败');
    }
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '同步失败');
  } finally {
    syncing.value = false;
  }
};

onMounted(load);
</script>
