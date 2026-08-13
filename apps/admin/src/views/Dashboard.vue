<template>
  <div class="dashboard">
    <el-row :gutter="20" class="stat-row">
      <el-col :span="4" v-for="stat in stats" :key="stat.label">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-icon" :style="{ background: stat.color }">
            <el-icon :size="28"><component :is="stat.icon" /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ stat.value }}</div>
            <div class="stat-label">{{ stat.label }}</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px;">
      <el-col :span="12">
        <el-card>
          <template #header>
            <span style="font-weight: 700;">最近订单</span>
          </template>
          <el-table :data="recentOrders" stripe size="small">
            <el-table-column prop="orderNo" label="订单号" />
            <el-table-column label="套餐">
              <template #default="{ row }">
                {{ row.package?.country?.name }} {{ row.package?.gb }}GB
              </template>
            </el-table-column>
            <el-table-column prop="price" label="金额">
              <template #default="{ row }">¥{{ row.price }}</template>
            </el-table-column>
            <el-table-column prop="status" label="状态">
              <template #default="{ row }">
                <el-tag :type="row.status === 'paid' ? 'success' : 'warning'" size="small">
                  {{ row.status === 'paid' ? '已支付' : '待支付' }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <span style="font-weight: 700;">最近 eSIM</span>
          </template>
          <el-table :data="recentEsims" stripe size="small">
            <el-table-column label="国家">
              <template #default="{ row }">
                {{ row.order?.package?.country?.flag }} {{ row.order?.package?.country?.name }}
              </template>
            </el-table-column>
            <el-table-column prop="iccid" label="ICCID" show-overflow-tooltip />
            <el-table-column prop="status" label="状态">
              <template #default="{ row }">
                <el-tag :type="row.status === 'activated' ? 'success' : 'info'" size="small">
                  {{ row.status === 'activated' ? '已激活' : '待激活' }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { adminApi } from '../api';

const stats = ref([
  { label: '国家/地区', value: 0, icon: 'MapLocation', color: '#0EA5E9' },
  { label: '套餐数量', value: 0, icon: 'ShoppingCart', color: '#FF7A59' },
  { label: '总订单', value: 0, icon: 'Document', color: '#14B8A6' },
  { label: '已支付', value: 0, icon: 'CircleCheck', color: '#10B981' },
  { label: 'eSIM 总数', value: 0, icon: 'Iphone', color: '#8B5CF6' },
  { label: '总收入', value: '¥0', icon: 'Money', color: '#F59E0B' },
]);

const recentOrders = ref([]);
const recentEsims = ref([]);

onMounted(async () => {
  try {
    const res = await adminApi.getDashboard();
    const s = res.data.data.stats;
    stats.value[0].value = s.countryCount;
    stats.value[1].value = s.packageCount;
    stats.value[2].value = s.orderCount;
    stats.value[3].value = s.paidOrders;
    stats.value[4].value = s.esimCount;
    stats.value[5].value = `¥${s.totalRevenue.toFixed(1)}`;

    const ordersRes = await adminApi.getOrders();
    recentOrders.value = ordersRes.data.data.orders.slice(0, 5);

    const esimsRes = await adminApi.getEsims();
    recentEsims.value = esimsRes.data.data.esims.slice(0, 5);
  } catch (e) {
    console.error(e);
  }
});
</script>

<style scoped>
.stat-row {
  margin-bottom: 0;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px;
}

.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 26px;
  font-weight: 800;
  color: #0F2A43;
}

.stat-label {
  font-size: 13px;
  color: #93AFC8;
  margin-top: 4px;
}
</style>
