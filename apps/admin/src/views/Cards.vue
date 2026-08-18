<template>
  <div>
    <el-card>
      <template #header>
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <span style="font-weight: 700;">卡片池管理</span>
          <div>
            <el-button type="primary" size="small" @click="showAddDialog">批量添加卡片</el-button>
          </div>
        </div>
      </template>

      <el-row :gutter="16" style="margin-bottom: 20px;">
        <el-col :span="6">
          <el-card shadow="never" style="text-align: center;">
            <div style="font-size: 28px; font-weight: 700; color: #0EA5E9;">{{ stats.total }}</div>
            <div style="font-size: 12px; color: #5B7A95;">卡片总数</div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card shadow="never" style="text-align: center;">
            <div style="font-size: 28px; font-weight: 700; color: #22C55E;">{{ stats.available }}</div>
            <div style="font-size: 12px; color: #5B7A95;">可用</div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card shadow="never" style="text-align: center;">
            <div style="font-size: 28px; font-weight: 700; color: #F59E0B;">{{ stats.used }}</div>
            <div style="font-size: 12px; color: #5B7A95;">已使用</div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card shadow="never" style="text-align: center;">
            <div style="font-size: 28px; font-weight: 700; color: #A1A1AA;">{{ stats.envOnly }}</div>
            <div style="font-size: 12px; color: #5B7A95;">仅环境变量</div>
          </el-card>
        </el-col>
      </el-row>

      <el-table :data="cards" stripe>
        <el-table-column prop="iccid" label="ICCID" width="280" />
        <el-table-column prop="remark" label="备注" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.used ? 'warning' : 'success'" size="small">
              {{ row.used ? '已使用' : '可用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="添加时间" width="170">
          <template #default="{ row }">{{ new Date(row.createdAt).toLocaleString('zh-CN') }}</template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="addDialogVisible" title="批量添加卡片" width="500px">
      <el-form>
        <el-form-item label="ICCID 列表">
          <el-input
            v-model="addInput"
            type="textarea"
            :rows="8"
            placeholder="每行一个 ICCID，或逗号分隔"
          />
        </el-form-item>
        <el-form-item label="备注（可选）">
          <el-input v-model="addRemark" placeholder="如：第一批采购" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="adding" @click="handleAdd">确认添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { adminApi } from '../api';

const cards = ref([]);
const stats = ref({ total: 0, available: 0, used: 0, envOnly: 0 });
const addDialogVisible = ref(false);
const addInput = ref('');
const addRemark = ref('');
const adding = ref(false);

async function loadCards() {
  const res = await adminApi.getCards();
  cards.value = res.data.data.cards;
  stats.value = res.data.data.stats;
}

function showAddDialog() {
  addInput.value = '';
  addRemark.value = '';
  addDialogVisible.value = true;
}

async function handleAdd() {
  const iccids = addInput.value
    .split(/[\n,，]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (iccids.length === 0) {
    ElMessage.warning('请至少输入一个 ICCID');
    return;
  }
  adding.value = true;
  try {
    const res = await adminApi.addCards(iccids, addRemark.value || undefined);
    ElMessage.success(`添加成功：${res.data.data.added} 张，跳过 ${res.data.data.skipped} 张重复`);
    addDialogVisible.value = false;
    loadCards();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || '添加失败');
  } finally {
    adding.value = false;
  }
}

async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm(
      `确认删除 ICCID：${row.iccid}？${row.used ? '该卡片已使用，删除后不影响已有 eSIM 业务。' : ''}`,
      '删除确认',
      { confirmButtonText: '确认删除', cancelButtonText: '取消', type: 'warning' },
    );
    await adminApi.deleteCard(row.iccid);
    ElMessage.success('删除成功');
    loadCards();
  } catch (e: any) {
    if (e === 'cancel' || e?.message === 'cancel') return;
    ElMessage.error(e?.response?.data?.message || '删除失败');
  }
}

onMounted(loadCards);
</script>