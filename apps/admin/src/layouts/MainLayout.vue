<template>
  <el-container class="admin-layout">
    <el-aside width="220px" class="admin-aside">
      <div class="logo">
        <el-icon size="28"><Promotion /></el-icon>
        <span>YYeSim</span>
      </div>
      <el-menu :default-active="$route.path" router class="admin-menu">
        <el-menu-item index="/dashboard">
          <el-icon><DataLine /></el-icon>
          <span>仪表盘</span>
        </el-menu-item>
        <el-menu-item index="/countries">
          <el-icon><MapLocation /></el-icon>
          <span>国家管理</span>
        </el-menu-item>
        <el-menu-item index="/packages">
          <el-icon><ShoppingCart /></el-icon>
          <span>套餐管理</span>
        </el-menu-item>
        <el-menu-item index="/orders">
          <el-icon><Document /></el-icon>
          <span>订单管理</span>
        </el-menu-item>
        <el-menu-item index="/esims">
          <el-icon><Iphone /></el-icon>
          <span>eSIM 管理</span>
        </el-menu-item>
        <el-menu-item index="/tiger-sync">
          <el-icon><Refresh /></el-icon>
          <span>????</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="admin-header">
        <div class="header-title">{{ $route.meta.title }}</div>
        <div class="header-user">
          <el-avatar :size="32" icon="UserFilled" />
          <span>管理员</span>
        </div>
      </el-header>
      <el-main class="admin-main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
</script>

<style scoped>
.admin-layout {
  height: 100vh;
}

.admin-aside {
  background: #001529;
  color: #fff;
}

.logo {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-size: 18px;
  font-weight: 700;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}

.admin-menu {
  border-right: none;
  background: transparent;
}

.admin-menu :deep(.el-menu-item) {
  color: rgba(255,255,255,0.7);
}

.admin-menu :deep(.el-menu-item:hover),
.admin-menu :deep(.el-menu-item.is-active) {
  color: #fff;
  background: #0EA5E9 !important;
}

.admin-header {
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 1px 4px rgba(0,0,0,0.05);
}

.header-title {
  font-size: 18px;
  font-weight: 700;
  color: #0F2A43;
}

.header-user {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #5B7A95;
}

.admin-main {
  background: #f4f6f8;
  padding: 24px;
}
</style>
