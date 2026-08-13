<template>
  <div>
    <el-card>
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 700;">国家/地区列表</span>
          <el-button type="primary" @click="openAdd">
            <el-icon><Plus /></el-icon> 添加国家
          </el-button>
        </div>
      </template>
      <el-table :data="countries" stripe>
        <el-table-column prop="flag" label="国旗" width="60" />
        <el-table-column prop="name" label="名称" />
        <el-table-column prop="en" label="英文" />
        <el-table-column prop="cat" label="分类" width="80" />
        <el-table-column prop="hot" label="热度" width="80" />
        <el-table-column prop="tier" label="价格等级" width="100" />
        <el-table-column label="套餐数" width="80">
          <template #default="{ row }">{{ row._count?.packages ?? row.packages?.length ?? 0 }}</template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="editCountry(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="deleteCountry(row.code)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="showAdd" :title="editing ? '编辑国家' : '添加国家'" width="500px" @open="onDialogOpen">
      <el-form :model="form" label-width="80px">
        <el-form-item label="代码"><el-input v-model="form.code" :disabled="!!editing" /></el-form-item>
        <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="英文"><el-input v-model="form.en" /></el-form-item>
        <el-form-item label="国旗"><el-input v-model="form.flag" /></el-form-item>
        <el-form-item label="拼音"><el-input v-model="form.pinyin" /></el-form-item>
        <el-form-item label="分类"><el-input v-model="form.cat" /></el-form-item>
        <el-form-item label="热度"><el-input-number v-model="form.hot" :min="0" :max="100" /></el-form-item>
        <el-form-item label="价格等级"><el-input-number v-model="form.tier" :min="1" :max="4" /></el-form-item>
        <el-form-item label="简介"><el-input v-model="form.intro" type="textarea" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAdd = false">取消</el-button>
        <el-button type="primary" @click="saveCountry">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { adminApi } from '../api';

const countries = ref([]);
const showAdd = ref(false);
const editing = ref(null);
const keyword = ref('');
const defaultForm = () => ({ code: '', name: '', en: '', flag: '', pinyin: '', cat: '', hot: 0, tier: 1, intro: '' });
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
  const res = await adminApi.getCountries({ keyword: keyword.value || undefined });
  countries.value = res.data.data.countries;
};

const editCountry = (row) => {
  editing.value = row;
  form.value = { ...row };
  showAdd.value = true;
};

const saveCountry = async () => {
  try {
    const data = {
      code: form.value.code,
      name: form.value.name,
      en: form.value.en,
      flag: form.value.flag,
      pinyin: form.value.pinyin,
      cat: form.value.cat,
      hot: form.value.hot,
      tier: form.value.tier,
      intro: form.value.intro,
    };
    if (editing.value) {
      await adminApi.updateCountry(editing.value.code, data);
    } else {
      await adminApi.createCountry(data);
    }
    ElMessage.success('保存成功');
    showAdd.value = false;
    editing.value = null;
    load();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '保存失败');
  }
};

const deleteCountry = async (code) => {
  await ElMessageBox.confirm('确定删除该国家？相关套餐也会被删除', '警告', { type: 'warning' });
  await adminApi.deleteCountry(code);
  ElMessage.success('已删除');
  load();
};

onMounted(load);
</script>
