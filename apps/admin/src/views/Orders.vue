<template>
  <div>
    <el-card>
      <template #header>
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <span style="font-weight: 700;">订单列表</span>
          <el-button size="small" @click="loadOrders">刷新</el-button>
        </div>
      </template>
      <el-table :data="orders" stripe>
        <el-table-column prop="orderNo" label="订单号" width="200" />
        <el-table-column label="套餐" width="180">
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
        <el-table-column prop="status" label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row)" size="small">{{ statusText(row) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="退款时间" width="170">
          <template #default="{ row }">
            {{ row.refundedAt ? new Date(row.refundedAt).toLocaleString('zh-CN') : '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="170">
          <template #default="{ row }">{{ new Date(row.createdAt).toLocaleString('zh-CN') }}</template>
        </el-table-column>
        <el-table-column label="操作" width="110" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="canRefund(row)"
              type="danger"
              size="small"
              @click="handleRefund(row)"
            >退款</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { adminApi } from '../api';

const orders = ref([]);

function statusText(row: any) {
  if (row.status === 'refunded' || row.refundedAt) return '已退款';
  if (row.status === 'paid') return '已支付';
  return '待支付';
}

function statusTagType(row: any) {
  if (row.status === 'refunded' || row.refundedAt) return 'info';
  if (row.status === 'paid') return 'success';
  return 'warning';
}

function canRefund(row: any) {
  return row.status === 'paid' && !row.refundedAt;
}

async function loadOrders() {
  const res = await adminApi.getOrders();
  orders.value = res.data.data.orders;
}

async function handleRefund(row: any) {
  try {
    const { value } = await ElMessageBox.prompt(
      `确认对订单 ${row.orderNo}（¥${row.price}）发起退款？退款成功后该订单的 eSIM 将失效并归还卡片。`,
      '订单退款',
      {
        confirmButtonText: '确认退款',
        cancelButtonText: '取消',
        inputPlaceholder: '请输入退款原因（可选）',
        inputValue: '',
      },
    );
    await adminApi.refundOrder(row.orderNo, value || undefined);
    ElMessage.success('退款成功');
    loadOrders();
  } catch (e: any) {
    if (e === 'cancel' || e?.message === 'cancel') return;
    ElMessage.error(e?.response?.data?.message || '退款失败，请重试');
  }
}

onMounted(loadOrders);
</script>
