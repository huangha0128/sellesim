// SMTP 连接测试脚本
// 运行：cd apps/server && node test-smtp.js
require('dotenv').config({ path: '../../.env' });
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 465,
  secure: process.env.SMTP_SECURE !== 'false',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

console.log('SMTP 配置：');
console.log('  Host:', process.env.SMTP_HOST);
console.log('  Port:', process.env.SMTP_PORT);
console.log('  Secure:', process.env.SMTP_SECURE);
console.log('  User:', process.env.SMTP_USER);
console.log('  Pass:', process.env.SMTP_PASS ? '***' + process.env.SMTP_PASS.slice(-4) : '(未设置)');
console.log();

// 验证连接
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ SMTP 连接失败：');
    console.error(error.message);
    console.error();
    console.error('常见原因：');
    console.error('1. 授权码错误（腾讯企业邮箱需要"客户端专用密码"，不是登录密码）');
    console.error('2. 授权码已过期或被停用');
    console.error('3. 服务器 IP 被腾讯企业邮箱拦截');
    console.error('4. SMTP 服务未开启（需在邮箱设置里勾选"开启 IMAP/SMTP 服务"）');
    process.exit(1);
  } else {
    console.log('✅ SMTP 连接成功！');
    console.log();

    // 发送测试邮件
    const testTo = process.argv[2] || process.env.SMTP_USER;
    console.log(`发送测试邮件到：${testTo}`);

    transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || 'YYeSim'}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: testTo,
      subject: '【YYeSim】SMTP 测试邮件',
      text: '这是一封测试邮件，用于验证 SMTP 配置是否正确。\n\n如果你收到这封邮件，说明邮件服务配置成功！',
    }).then(() => {
      console.log('✅ 测试邮件发送成功！请检查收件箱。');
      process.exit(0);
    }).catch(err => {
      console.error('❌ 邮件发送失败：');
      console.error(err.message);
      process.exit(1);
    });
  }
});
