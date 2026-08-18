<template>
  <div class="tiger-sync">
    <el-row :gutter="20">
      <el-col :span="16">
        <el-card class="status-card">
          <template #header>
            <div class="card-head">
              <span style="font-weight: 700;">Tiger 同步状态</span>
              <el-tag :type="status.configured ? 'success' : 'danger'">
                {{ status.configured ? '已连接 Tiger' : '未连接' }}
              </el-tag>
            </div>
          </template>

          <el-descriptions :column="2" border>
            <el-descriptions-item label="API 地址">{{ status.baseUrl || '-' }}</el-descriptions-item>
            <el-descriptions-item label="连接模式">{{ status.mode === 'tiger' ? 'Tiger 模式' : '模拟模式' }}</el-descriptions-item>
            <el-descriptions-item label="国家/地区">
              <span>{{ status.countryCount || 0 }} 个</span>
            </el-descriptions-item>
            <el-descriptions-item label="套餐总数">
              <span>{{ status.packageCount || 0 }} 个</span>
            </el-descriptions-item>
            <el-descriptions-item label="ICCID 池">
              <span>{{ status.iccidPoolSize || 0 }} 个</span>
            </el-descriptions-item>
            <el-descriptions-item label="同步状态">
              <el-tag :type="status.synced ? 'success' : 'info'" size="small">
                {{ status.synced ? '已同步' : '未同步' }}
              </el-tag>
            </el-descriptions-item>
          </el-descriptions>

          <div class="actions" style="margin-top: 20px;">
            <el-button type="primary" :loading="syncingAll" @click="syncAll">
              全量同步所有数据
            </el-button>
            <el-button :loading="syncingRegions" @click="syncRegions">同步国家/地区</el-button>
            <el-button :loading="syncingPkgs" @click="syncPackages">同步套餐</el-button>
          </div>
          <div v-if="lastResult" style="margin-top: 16px;">
            <el-alert
              :title="lastResult.message"
              type="success"
              :closable="false"
              show-icon
              style="margin-bottom: 8px;"
            />
            <el-descriptions :column="3" size="small" border>
              <el-descriptions-item label="新增">{{ lastResult.regionsSynced || 0 }}</el-descriptions-item>
              <el-descriptions-item label="套餐">{{ lastResult.packagesSynced || 0 }}</el-descriptions-item>
              <el-descriptions-item label="套餐总数">{{ lastResult.packageTotal || 0 }}</el-descriptions-item>
            </el-descriptions>
          </div>
          <div v-if="errorMsg" style="margin-top: 16px;">
            <el-alert :title="errorMsg" type="error" :closable="false" show-icon />
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card>
          <template #header><span style="font-weight: 700;">说明</span></template>
          <ul style="line-height: 1.9; padding-left: 18px; color: #5B7A95;">
            <li>从 Tiger eSIM 合作伙伴平台同步国家/地区、套餐数据</li>
            <li>同步后会自动创建或更新本地数据库中的套餐信息</li>
            <li>套餐价格以 Tiger API 返回的 USD 价格为准</li>
            <li>全量同步会先同步国家，再同步套餐</li>
            <li>建议在套餐变动时手动触发同步</li>
          </ul>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { adminApi } from '../api';

const status = ref<any>({});
const errorMsg = ref('');
const lastResult = ref<any>(null);
const syncingAll = ref(false);
const syncingRegions = ref(false);
const syncingPkgs = ref(false);

async function load() {
  try {
    const res = await adminApi.getTigerStatus();
    status.value = res.data.data || {};
  } catch (e: any) {
    errorMsg.value = e?.response?.data?.message || '获取 Tiger 状态失败';
  }
}

async function syncAll() {
  syncingAll.value = true;
  errorMsg.value = '';
  try {
    const res = await adminApi.syncTigerAll();
    if (res.data.code === 0) {
      lastResult.value = res.data.data;
      ElMessage.success('同步成功');
      load();
    } else {
      errorMsg.value = res.data.message;
    }
  } catch (e: any) {
    errorMsg.value = e?.response?.data?.message || '同步失败';
  } finally {
    syncingAll.value = false;
  }
}

async function syncRegions() {
  syncingRegions.value = true;
  errorMsg.value = '';
  try {
    const res = await adminApi.syncTigerRegions();
    if (res.data.code === 0) {
      lastResult.value = res.data.data;
      ElMessage.success('同步成功');
      load();
    } else {
      errorMsg.value = res.data.message;
    }
  } catch (e: any) {
    errorMsg.value = e?.response?.data?.message || '同步失败';
  } finally {
    syncingRegions.value = false;
  }
}

async function syncPackages() {
  syncingPkgs.value = true;
  errorMsg.value = '';
  try {
    const res = await adminApi.syncTigerPackages();
    if (res.data.code === 0) {
      lastResult.value = res.data.data;
      ElMessage.success('同步成功');
      load();
    } else {
      errorMsg.value = res.data.message;
    }
  } catch (e: any) {
    errorMsg.value = e?.response?.data?.message || '同步失败';
  } finally {
    syncingPkgs.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
