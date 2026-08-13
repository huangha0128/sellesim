<template>
  <div class="tiger-sync">
    <el-row :gutter="20">
      <el-col :span="16">
        <el-card class="status-card">
          <template #header>
            <div class="card-head">
              <span style="font-weight: 700;">Tiger ??????</span>
              <el-tag :type="status.configured ? 'success' : 'danger'">
                {{ status.configured ? '??? Tiger ????' : '???' }}
              </el-tag>
            </div>
          </template>

          <el-descriptions :column="2" border>
            <el-descriptions-item label="API ??">{{ status.baseUrl || '-' }}</el-descriptions-item>
            <el-descriptions-item label="????">{{ status.mode === 'tiger' ? 'Tiger ????' : '????' }}</el-descriptions-item>
            <el-descriptions-item label="??/??">
              <span>{{ status.countryCount || 0 }} ?</span>
            </el-descriptions-item>
            <el-descriptions-item label="????">
              <span>{{ status.packageCount || 0 }} ?</span>
            </el-descriptions-item>
            <el-descriptions-item label="ICCID ??">
              <span>{{ status.iccidPoolSize || 0 }} ?</span>
            </el-descriptions-item>
            <el-descriptions-item label="???">
              <el-tag :type="status.synced ? 'success' : 'info'" size="small">
                {{ status.synced ? '???' : '???' }}
              </el-tag>
            </el-descriptions-item>
          </el-descriptions>

          <div class="actions" style="margin-top: 20px;">
            <el-button type="primary" :loading="syncingAll" @click="syncAll">
              ??????????
            </el-button>
            <el-button :loading="syncingRegions" @click="syncRegions">????/??</el-button>
            <el-button :loading="syncingPkgs" @click="syncPackages">????</el-button>
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
              <el-descriptions-item label="??">{{ lastResult.regionsSynced || 0 }}</el-descriptions-item>
              <el-descriptions-item label="??">{{ lastResult.packagesSynced || 0 }}</el-descriptions-item>
              <el-descriptions-item label="??????">{{ lastResult.packageTotal || 0 }}</el-descriptions-item>
            </el-descriptions>
          </div>
          <div v-if="errorMsg" style="margin-top: 16px;">
            <el-alert :title="errorMsg" type="error" :closable="false" show-icon />
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card>
          <template #header><span style="font-weight: 700;">??</span></template>
          <ul style="line-height: 1.9; padding-left: 18px; color: #5B7A95;">
            <li>???? Tiger ??????/????? eSIM ?????</li>
            <li>??????????????????????</li>
            <li>????????????????????</li>
            <li>????? Tiger ????USD??</li>
            <li>?????????????????????</li>
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
    errorMsg.value = e?.response?.data?.message || '?? Tiger ????';
  }
}

async function syncAll() {
  syncingAll.value = true;
  errorMsg.value = '';
  try {
    const res = await adminApi.syncTigerAll();
    if (res.data.code === 0) {
      lastResult.value = res.data.data;
      ElMessage.success('??????');
      load();
    } else {
      errorMsg.value = res.data.message;
    }
  } catch (e: any) {
    errorMsg.value = e?.response?.data?.message || '??????';
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
      ElMessage.success('??????');
      load();
    } else {
      errorMsg.value = res.data.message;
    }
  } catch (e: any) {
    errorMsg.value = e?.response?.data?.message || '??????';
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
      ElMessage.success('??????');
      load();
    } else {
      errorMsg.value = res.data.message;
    }
  } catch (e: any) {
    errorMsg.value = e?.response?.data?.message || '??????';
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
