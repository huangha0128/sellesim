<template>
  <div>
    <el-card>
      <template #header>
        <span style="font-weight: 700;">订单列表</span>
      </template>
      <el-table :data="orders" stripe>
        <el-table-column prop="orderNo" label="订单号" width="200" />
        <el-table-column label="套餐" width="160">
          <template #default="{ row }">
            {{ row.package?.country?.flag }} {{ row.package?.country?.name }} {{ row.package?.gb }}GB/{{ row.package?.days }}天
          </template>
        </el-table-column>
        <el-table-column prop="email" label="邮箱" />
        <el-table-column prop="payMethod" label="支付方式" width="100">
          <template #default="{ row }">{{ row.payMethod === 'alipay' ? '支付宝' : '微信' }}</template>
        </el-table-column>
        <el-table-column prop="price" label="金额" width="100">
          <template #default="{ row }">¥{{ row.price }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'paid' ? 'success' : 'warning'" size="small">
              {{ row.status === 'paid' ? '已支付' : '待支付' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="180">
          <template #default="{ row }">{{ new Date(row.createdAt).toLocaleString('zh-CN') }}</template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { adminApi } from '../api';

const orders = ref([]);

onMounted(async () => {
  const res = await adminApi.getOrders();
  orders.value = res.data.data.orders;
});
</script>
