<template>
  <div>
    
    <el-card style="margin-bottom: 16px;">
      <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
        <el-input v-model="query.keyword" placeholder="????? / ???? / ??" clearable style="width: 240px;" @keyup.enter="load" @clear="load" />
        <el-input v-model="query.countryCode" placeholder="?????? JP?" clearable style="width: 160px;" @keyup.enter="load" @clear="load" />
        <el-switch v-model="query.onlyFeatured" active-text="????" @change="load" />
        <el-button type="primary" @click="load">??</el-button>
        <el-button type="primary" plain @click="openAdd">????</el-button>
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
        <el-table-column label="国家" width="120">
          <template #default="{ row }">{{ row.country?.flag }} {{ row.country?.name }}</template>
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

    <el-dialog v-model="showAdd" :title="editing ? '编辑套餐' : '添加套餐'" width="550px" @open="onDialogOpen">
      <el-form :model="form" label-width="90px">
        <el-form-item label="国家代码"><el-input v-model="form.countryCode" :disabled="!!editing" /></el-form-item>
        <el-form-item label="流量 (GB)"><el-input-number v-model="form.gb" :min="1" /></el-form-item>
        <el-form-item label="有效期 (天)"><el-input-number v-model="form.days" :min="1" /></el-form-item>
        <el-form-item label="价格 (¥)"><el-input-number v-model="form.price" :min="0" :precision="1" /></el-form-item>
        <el-form-item label="类型"><el-input v-model="form.type" /></el-form-item>
        <el-form-item label="网络"><el-input v-model="form.network" /></el-form-item>
        <el-form-item label="速度"><el-input v-model="form.speed" /></el-form-item>
        <el-form-item label="覆盖"><el-input v-model="form.coverage" /></el-form-item>
        <el-form-item label="标签"><el-input v-model="form.tag" /></el-form-item>
        <el-form-item label="标签颜色"><el-color-picker v-model="form.tagColor" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="form.desc" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAdd = false">取消</el-button>
        <el-button type="primary" @click="savePkg">保存</el-button>
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
const query = ref({ keyword: '', countryCode: '', onlyFeatured: false });
const defaultForm = () => ({ countryCode: '', gb: 1, days: 7, price: 0, type: '本地套餐', network: '4G/5G', speed: '高速', coverage: '', tag: '', tagColor: '', desc: '', features: '[]', installSteps: '[]' });
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
  form.value = { ...row };
  showAdd.value = true;
};

const savePkg = async () => {
  try {
    const data = {
      countryCode: form.value.countryCode,
      gb: form.value.gb,
      days: form.value.days,
      price: form.value.price,
      type: form.value.type,
      network: form.value.network,
      speed: form.value.speed,
      coverage: form.value.coverage,
      tag: form.value.tag || '',
      tagColor: form.value.tagColor || '',
      desc: form.value.desc,
      features: form.value.features || '[]',
      installSteps: form.value.installSteps || '[]',
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
  }
};

const deletePkg = async (id) => {
  await ElMessageBox.confirm('确定删除该套餐？', '警告', { type: 'warning' });
  await adminApi.deletePackage(id);
  ElMessage.success('已删除');
  load();
};

onMounted(load);
</script>
