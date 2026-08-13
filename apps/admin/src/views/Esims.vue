<template>
  <div>
    <el-card>
      <template #header>
        <span style="font-weight: 700;">eSIM 列表</span>
      </template>
      <el-table :data="esims" stripe>
        <el-table-column label="国家" width="140">
          <template #default="{ row }">
            {{ row.order?.package?.country?.flag }} {{ row.order?.package?.country?.name }}
          </template>
        </el-table-column>
        <el-table-column prop="iccid" label="ICCID" width="220" show-overflow-tooltip />
        <el-table-column label="激活码" show-overflow-tooltip>
          <template #default="{ row }">{{ row.activationCode }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'activated' ? 'success' : 'info'" size="small">
              {{ row.status === 'activated' ? '已激活' : '待激活' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="有效期" width="180">
          <template #default="{ row }">{{ new Date(row.expireAt).toLocaleDateString('zh-CN') }}</template>
        </el-table-column>
        <el-table-column prop="used" label="已用流量" width="100">
          <template #default="{ row }">{{ row.used }}GB</template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { adminApi } from '../api';

const esims = ref([]);

onMounted(async () => {
  const res = await adminApi.getEsims();
  esims.value = res.data.data.esims;
});
</script>
